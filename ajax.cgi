#!/usr/bin/perl -wT

use strict;

use lib ('.');

#######
## INCLUDES
#######

use Database;
use CGI;
use HTML::Template;
use XML::Simple;

require 'config.pl';

#######
## GLOBAL VARIABLES
#######

my $cgi    = new CGI;
my $db     = new Database;
my $parser = new XML::Simple;

#######
## GLOBAL INITIALIZATION
#######
$db->init($Config::db_user, $Config::db_pass, $Config::db_name);

#######
## DISPATCHING
#######

my $action = $cgi->param('action');

my %actions = (
	'add'    => \&add_new_item,
	'day'    => \&change_day,
	'save'   => \&save_item,
	'done'   => \&toggle_item_done,
	'delete' => \&delete_item
);

if ($actions{ $action }) {
	$actions{ $action }->();
}

#######
## ADD NEW ITEM
#######

sub add_new_item()
{
	# Get CGI parameters
	my $week     = $cgi->param('week') || 1;
	my $day      = $cgi->param('day');
	my $event    = $cgi->param('event');
	my $start    = $cgi->param('start');
	my $end      = $cgi->param('end');
	my $location = $cgi->param('location');

	# Check that the important stuff is here
	unless ($week && $event) {
		exit;
	}

	# A day value of '-' should be emptied to be NULL in the DB for "no day"
	my $origday = $day;
	if ($day eq '-') {
		$day = '';
	}

	undef $start unless $start;
	undef $end unless $end;
	undef $location unless $location;

	# Remove leading and trailing spaces
	$event    = &trim($event);
	$location = &trim($location);

	# Add the new record to the DB
	my $query = qq~
		INSERT INTO ${Config::prefix}todo
		(week, day, event, location, start, end)
		VALUES
		(?, ?, ?, ?, ?, ?)
	~;
	$db->prepare($query);
	$db->execute($week, $day, $event, $location, $start, $end);

	my $new_id = $db->insert_id();

	$day = -1 if $origday eq '-';

	# Get the new item
	$query = qq~
		SELECT id, week, day, event, location, start, end, done
		FROM todo
		WHERE id = ?
	~;
	$db->prepare($query);
	my $sth = $db->execute($new_id);

	my $item = $sth->fetchrow_hashref();

	print "Content-type: text/xml\n\n";
	print &item_to_xml($item);
}

#######
## CHANGE DAY
#######
sub change_day()
{
	# Get CGI parameters
	my $id  = $cgi->param('id');
	my $day = $cgi->param('day');

	if ($day eq '8') {
		# Move to next week

		## Get item info
		my $query = qq~
			SELECT id, week
			FROM todo
			WHERE id = ?
		~;
		$db->prepare($query);
		my $sth = $db->execute($id);
		my $item = $sth->fetchrow_hashref();

		return unless ($item && $item->{'id'});

		## Get the week the item's currently in
		$query = qq~
			SELECT id, start, end
			FROM todo_weeks
			WHERE id = ?
		~;
		$db->prepare($query);
		$sth = $db->execute($item->{'week'});
		my $old_week = $sth->fetchrow_hashref();

		## Check if the next week already exists
		$query = qq~
			SELECT id, start, end
			FROM todo_weeks
			WHERE start = DATE_ADD(?, INTERVAL 1 DAY)
		~;
		$db->prepare($query);
		$sth = $db->execute($old_week->{'end'});
		my $new_week = $sth->fetchrow_hashref();

		unless ($new_week && $new_week->{'id'}) {
			$new_week = &create_week($old_week);
		}

		## Update item
		$query = qq~
			UPDATE todo SET
				week = ?
			WHERE id = ?
		~;
		$db->prepare($query);
		$db->execute($new_week->{'id'}, $item->{'id'});
	} elsif ($day eq '-') {
		## Set to NULL

		# Update the record
		my $query = qq~
			UPDATE todo SET
				day = NULL
			WHERE id = ?
		~;
		$db->prepare($query);
		$db->execute($id);
	} else {
		# Update the record
		my $query = qq~
			UPDATE todo SET
				day = ?
			WHERE id = ?
		~;
		$db->prepare($query);
		$db->execute($day, $id);
	}

	# Load the item
	my $query = qq~
		SELECT id, week, day, event, location, start, end, done
		FROM todo
		WHERE id = ?
	~;
	$db->prepare($query);
	my $sth = $db->execute($id);

	my $item = $sth->fetchrow_hashref();

	print "Content-type: text/xml\n\n";
	print &item_to_xml($item);
}

######
## SAVE ITEM
######


## Bitwise flags for what changed
## 1     event
## 2     location
## 4     times
sub save_item()
{
	# Get CGI parameters
	my $changed  = $cgi->param('changed');
	my $id       = $cgi->param('id');
	my $event    = $cgi->param('event');
	my $location = $cgi->param('location');
	my $start    = $cgi->param('start');
	my $end      = $cgi->param('end');

	if ($changed & 1) {
		# Trim spaces
		$event = &trim($event);
		my $query = qq~
			UPDATE todo SET
				event = ?
			WHERE id = ?
		~;
		$db->prepare($query);
		$db->execute($event, $id);
	}

	if ($changed & 2) {
		undef $location unless $location;
		$location = &trim($location);
		my $query = qq~
			UPDATE todo SET
				location = ?
			WHERE id = ?
		~;
		$db->prepare($query);
		$db->execute($location, $id);
	}

	if ($changed & 4) {
		undef $start unless $start;
		undef $end unless $end;
		my $query = qq~
			UPDATE todo SET
				start = ?,
				end   = ?
			WHERE id = ?
		~;
		$db->prepare($query);
		$db->execute($start, $end, $id);
	}

	# Get the item
	my $query = qq~
		SELECT id, week, day, event, location, start, end, done
		FROM todo
		WHERE id = ?
	~;
	$db->prepare($query);
	my $sth = $db->execute($id);

	my $item = $sth->fetchrow_hashref();

	print "Content-type: text/xml\n\n";
	print &item_to_xml($item);
}

#######
## DELETE ITEM
#######
sub delete_item()
{
	# Get CGI params
	my $id = $cgi->param('id');

	# Delete the item
	my $query = qq~
		DELETE FROM todo
		WHERE id = ?
	~;
	$db->prepare($query);
	$db->execute($id);

	# No output necessary, except a header
	print $cgi->header();
}

#######
## TOGGLE "DONE" STATE
#######
sub toggle_item_done()
{
	# Get CGI params
	my $id = $cgi->param('id');

	# Get the item
	my $query = qq~
		SELECT id, week, day, event, location, start, end, done
		FROM todo
		WHERE id = ?
	~;
	$db->prepare($query);
	my $sth = $db->execute($id);
	my $item = $sth->fetchrow_hashref();

	$item->{'done'} = !$item->{'done'};

	# Update item
	$query = qq~
		UPDATE todo SET
			done = ?
		WHERE id = ?
	~;
	$db->prepare($query);
	$db->execute($item->{'done'}, $id);

	# Output
	print "Content-type: text/xml\n\n";
	print &item_to_xml($item);
}

#######
## ITEM TO XML
## Returns the XML for the item
#######
sub item_to_xml()
{
	my $item = shift;

	# Load XML template
	my $xml = new HTML::Template(filename => 'item.xtmpl');

	# Set template params
	$xml->param(id       => $item->{'id'});
	$xml->param(week     => $item->{'week'});
	$xml->param(day      => $item->{'day'});
	$xml->param(event    => $item->{'event'});
	$xml->param(location => $item->{'location'});
	$xml->param(start    => $item->{'start'});
	$xml->param(end      => $item->{'end'});
	$xml->param(done     => $item->{'done'});
	
	return $xml->output();
}

#######
## CREATE WEEK IN DB
## Create a week after the given one
#######
sub create_week()
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
