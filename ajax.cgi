#!/usr/bin/perl -wT

use strict;

use lib ('.');

#######
## INCLUDES
#######

use Database;
use CGI;
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
	my $origday= $day;
	if ($day eq '-') {
		$day = '';
	}

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
		SELECT id, day, event, location, start, end, done
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

	# Update the record
	my $query = qq~
		UPDATE todo SET
			day = ?
		WHERE id = ?
	~;
	$db->prepare($query);
	$db->execute($day, $id);

	# Load the item
	$query = qq~
		SELECT id, day, event, location, start, end, done
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
		my $query = qq~
			UPDATE todo SET
				event = ?
			WHERE id = ?
		~;
		$db->prepare($query);
		$db->execute($event, $id);
	}

	if ($changed & 2) {
		my $query = qq~
			UPDATE todo SET
				location = ?
			WHERE id = ?
		~;
		$db->prepare($query);
		$db->execute($location, $id);
	}

	if ($changed & 4) {
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
		SELECT id, day, event, location, start, end, done
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
		SELECT id, day, event, location, start, end, done
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

	my $output;
	$output = qq~<item>
	<id>$item->{'id'}</id>
	<day>$item->{'day'}</day>
	<event>$item->{'event'}</event>
	<location>$item->{'location'}</location>
	<start>$item->{'start'}</start>
	<end>$item->{'end'}</end>
	<done>$item->{'done'}</done>
</item>~;
	
	return $output;
}
