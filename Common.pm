package Common;

#######
## PERL SETUP
#######
use strict;

#######
## INCLUDES
#######
require 'config.pl';

use CGI;
use CGI::Carp 'fatalsToBrowser';
use Database;
use HTML::Template;
use POSIX;

#######
## GLOBALS
#######
our $cgi = new CGI;
our $db = new Database;
$db->init($Config::db_user, $Config::db_pass, $Config::db_name, 'localhost', \&error);

##############

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

	&output($html);

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
## IS TEMPLATE LOADED?
## Checks if the template has been loaded for the specified day.
## If the given day is earlier than the current day, treat it as though it has the template loaded.
#######
sub template_loaded()
{
	my $date = shift;

	my $query = qq~
		SELECT (IF(COUNT(*) > 0, 1, 0) + IF(? < DATE(NOW()), 1, 0)) loaded
		FROM template_loaded
		WHERE `date` = ?
	~;
	$db->prepare($query);
	my $sth = $db->execute($date, $date);

	my $loaded = $sth->fetchrow_hashref()->{'loaded'};

	return $loaded;
}

#######
## LOAD TEMPLATE
## Loads the template for the specified date.
#######
sub load_template()
{
	# Get parameters
	my $date = shift;

	$db->start_transaction();

	# Get all template items for the day
	my $query = qq~
		SELECT id, event, location, start, end, mark
		FROM template_items
		WHERE day = DAYOFWEEK(?)
	~;
	$db->prepare($query);
	my $get_items = $db->execute($date);

	# Query for getting tags from a template item
	$query = qq~
		SELECT tag_id
		FROM template_item_tags
		WHERE item_id = ?
	~;
	my $get_tags = $db->prepare($query);

	# Query to insert items into 'todo' table
	$query = qq~
		INSERT INTO todo
		(`date`, event, location, start, end, mark)
		VALUES
		(?, ?, ?, ?, ?, ?)
	~;
	my $insert = $db->prepare($query);

	# Query to add tags to new item
	$query = qq~
		INSERT INTO item_tags
		(item_id, tag_id)
		VALUES
		(?, ?)
	~;
	my $add_tags = $db->prepare($query);

	while (my $item = $get_items->fetchrow_hashref()) {
		$insert->execute($date, $item->{'event'}, $item->{'location'}, $item->{'start'}, $item->{'end'}, $item->{'mark'});
		my $new_id = $insert->{'mysql_insertid'};

		# Get tags for this template item
		$get_tags->execute($item->{'id'});
		while (my $tag = $get_tags->fetchrow_hashref()) {
			$add_tags->execute($new_id, $tag->{'tag_id'});
		}
	}

	# Mark the template as loaded for this day
	$query = qq~
		INSERT INTO template_loaded
		(`date`)
		VALUES
		(?)
	~;
	$db->prepare($query);
	$db->execute($date);

	$db->commit_transaction();
}

#######
## ITEM TO XML
## Returns an HTML::Template object to get the XML for the item
#######
sub item_to_xml()
{
	my $item = shift;

	# Load XML template
	my $xml = &load_xml_template('item');

	# Set template params
	$xml->param(id        => $item->{'id'});
	$xml->param(day       => $item->{'day'});
	$xml->param(date      => $item->{'date'});
	$xml->param(event     => $item->{'event'});
	$xml->param(location  => $item->{'location'});
	$xml->param(start     => $item->{'start'});
	$xml->param(end       => $item->{'end'});
	$xml->param(done      => $item->{'done'});
	$xml->param(mark      => $item->{'mark'});
	$xml->param(tags      => $item->{'tags'});
	$xml->parm(keep_until => $item->{'keep_until'});
	
	return $xml;
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

#######
## OUTPUT
#######
sub output()
{
	my ($tmpl, $xml) = @_;

	if ($xml) {
		print $cgi->header( -type => 'text/xml', -charset => 'UTF-8' );
	} else {
		print $cgi->header( -charset => 'UTF-8' );
	}
	if ($tmpl) {
		print $tmpl->output();
	}
}

1;

