package Common;

#######
## PERL SETUP
#######
use strict;

#######
## INCLUDES
#######
use CGI;
use Database;
use HTML::Template;
use POSIX;
require 'config.pl';

#######
## GLOBALS
#######
our $cgi = new CGI;
our $db = new Database;
$db->init($Config::db_user, $Config::db_pass, $Config::db_name, 'localhost', \&error);

##############

#######
## CREATE WEEK
## Given a date (YYYYMMDD), creates the week containing it in the database
#######
sub create_week()
{
	my $date = shift;

	# Get component parts of date
	my $year  = substr($date, 0, 4);
	my $month = substr($date, 4, 2);
	my $day   = substr($date, 6, 2);

	# Build UNIX-style date for date
	my $unix_date = mktime(0, 0, 0, $day, $month - 1, $year - 1900, 0, 0);

	# Get parts to find out what day of the week this is
	my @date_parts = localtime($unix_date);

	# Set this date back to Sunday
	my $start_date = $unix_date - ($date_parts[6] * 24 * 60 * 60);

	# Add 6 days to start date to get end date
	my $end_date = $start_date + (6 * 24 * 60 * 60);

	# Get component parts for start date
	my @start_date  = localtime($start_date);
	my $start_year  = $start_date[5] + 1900;
	my $start_month = $start_date[4] + 1;
	my $start_day   = $start_date[3];

	# Get component parts for end date
	my @end_date  = localtime($end_date);
	my $end_year  = $end_date[5] + 1900;
	my $end_month = $end_date[4] + 1;
	my $end_day   = $end_date[3];

	# Build start date string
	$start_date = $start_year . &fix_date($start_month) . &fix_date($start_day);

	# Build end date string
	$end_date = $end_year . &fix_date($end_month) . &fix_date($end_day);

	my $query = qq~
		INSERT INTO todo_weeks
		(start, end)
		VALUES
		(?, ?)
	~;
	$db->prepare($query);
	$db->execute($start_date, $end_date);

	my $new_id = $db->insert_id();

	# Load template, if requested
	if ($Config::auto_load) {
		&load_template($new_id);
	}

	$query = qq~
		SELECT id, start
		FROM todo_weeks
		WHERE id = ?
	~;
	$db->prepare($query);
	my $sth = $db->execute($new_id);

	return $sth->fetchrow_hashref();
}

#######
## FIX DATE
## Given a part of a date, adds a leading 0 if the value is less than 10 and a leading 0 isn't present
#######
sub fix_date()
{
	my $date = shift;

	if ($date >= 10 || length($date) == 2) {
		return $date;
	}

	return '0' . $date;
}

#######
## LOAD HTML TEMPLATE
######
sub load_html_template()
{
	my $name = shift;

	my $html = new HTML::Template(
		filename          => 'templates/' . $name . '.tmpl',
		global_vars       => 1,
		loop_context_vars => 1
	);
}

#######
## LOAD XML TEMPLATE
## Given a filename (without extension), loads it as an HTML::Template object and returns it.
#######
sub load_xml_template()
{
	my $filename = shift;

	my $xml = new HTML::Template(
		filename          => 'templates/' . $filename . '.xtmpl',
		global_vars       => 1,
		loop_context_vars => 1
	);

	return $xml;
}

#######
## ERROR
## Displays an error message to the user
#######
sub error()
{
	my ($message, $db_error) = @_;

	if ($db_error && !$Config::DEBUG) {
		$message = 'A database error has occurred.';
	}

	my $html = &load_html_template('error');

	$html->param(message => $message);

	print $cgi->header();
	print $html->output();

	exit;
}

#######
## GET MONTH NAME
## Returns the name corresponding to the given value (1-12)
#######
sub get_month_name()
{
	my $month = shift;

	my @months = ( 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' );

	return $months[$month - 1];
}

#######
## GET DAY NAME
## Returns the name (or display value) corresponding to the given numeric value
#######
sub get_day_name()
{
	my $day = shift;

	return '--' if ($day == -1 || $day == 7);

	my @days = ( 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' );

	return $days[$day];
}

#######
## LOAD TEMPLATE
## Loads the template into the specified week
#######
sub load_template()
{
	# Get parameters
	my $week_id = shift;

	my $week;

	unless ($week_id) {
		# use current date if none is given
		my @date_parts = localtime(time());

		my $day = ($date_parts[5] + 1900) . &Common::fix_date($date_parts[4] + 1) . &Common::fix_date($date_parts[3]);

		# Get the week this day is in
		my $query = qq~
			SELECT id, start
			FROM todo_weeks
			WHERE start <= ? AND end >= ?
		~;
		$db->prepare($query);
		my $sth = $db->execute($day, $day);

		$week = $sth->fetchrow_hashref();

		unless ($week) {
			$week = &Common::create_week($day);
		}
	} else {
		my $query = qq~
			SELECT id, start
			FROM todo_weeks
			WHERE id = ?
		~;
		$db->prepare($query);
		my $sth = $db->execute($week_id);

		$week = $sth->fetchrow_hashref();		
	}

	exit unless $week;

	# Get the week ID for the template week
	my $query = qq~
		SELECT id
		FROM todo_weeks
		WHERE start IS NULL AND end IS NULL
	~;
	$db->prepare($query);
	my $sth = $db->execute();

	my $template_week = $sth->fetchrow_hashref();

	# Fetch the items in the template
	$query = qq~
		SELECT id, day, event, location, start, end, done, mark
		FROM todo
		WHERE week = ?
	~;
	$db->prepare($query);
	$sth = $db->execute($template_week->{'id'});

	# Add the items to the specified week
	$query = qq~
		INSERT INTO todo
		(week, day, event, location, start, end, done, mark)
		VALUES
		(?, ?, ?, ?, ?, ?, ?, ?)
	~;
	$db->prepare($query);

	while (my $item = $sth->fetchrow_hashref()) {
		$db->execute($week->{'id'}, $item->{'day'}, $item->{'event'}, $item->{'location'}, $item->{'start'}, $item->{'end'}, $item->{'done'}, $item->{'mark'});
	}

	return $week;
}

#######
## ITEM TO XML
## Returns the XML for the item
#######
sub item_to_xml()
{
	my $item = shift;

	# Load XML template
	my $xml = &load_xml_template('item');

	# Set template params
	$xml->param(id       => $item->{'id'});
	$xml->param(week     => $item->{'week'});
	$xml->param(day      => $item->{'day'});
	$xml->param(date     => $item->{'date'});
	$xml->param(event    => $item->{'event'});
	$xml->param(location => $item->{'location'});
	$xml->param(start    => $item->{'start'});
	$xml->param(end      => $item->{'end'});
	$xml->param(done     => $item->{'done'});
	$xml->param(mark     => $item->{'mark'});
	
	return $xml->output();
}

#######
## CREATE WEEK AFTER
## Create a week after the given one
#######
sub create_week_after()
{
	my $old_week = shift;

	# Add new week
	my $query = qq~
		INSERT INTO todo_weeks
		(start, end)
		VALUES
		(DATE_ADD(?, INTERVAL 1 DAY), DATE_ADD(?, INTERVAL 7 DAY))
	~;
	$db->prepare($query);
	$db->execute($old_week->{'end'}, $old_week->{'end'});

	my $new_week_id = $db->insert_id();

	# Get new week
	$query = qq~
		SELECT id, start, end
		FROM todo_weeks
		WHERE id = ?
	~;
	$db->prepare($query);
	my $sth = $db->execute($new_week_id);

	return $sth->fetchrow_hashref();
}

#######
## TRIM SPACES
#######
sub trim()
{
	my $str = shift;
	return undef unless $str;

	$str =~ s/^\s*(.+)\s*$/$1/;

	return $str;
}

1;

