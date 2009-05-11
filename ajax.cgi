#!/usr/bin/perl -wT

use strict;

use lib ('.');

#######
## INCLUDES
#######
use Common;
use POSIX;
use XML::Simple;

require 'config.pl';

#######
## GLOBAL VARIABLES
#######
my $parser = new XML::Simple;

#######
## DISPATCHING
#######

my $action = $Common::cgi->param('action');

my %actions = (
	'add'    => \&add_new_item,
	'day'    => \&change_day,
	'save'   => \&save_item,
	'done'   => \&toggle_item_done,
	'delete' => \&delete_item,
	'mark'   => \&toggle_marked,
	'move'   => \&move_unfinished
);

if ($action && $actions{ $action }) {
	$actions{ $action }->();
}

#######
## ADD NEW ITEM
#######

sub add_new_item()
{
	# Get CGI parameters
	my $week     = $Common::cgi->param('week') || 1;
	my $day      = $Common::cgi->param('day');
	my $event    = $Common::cgi->param('event');
	my $start    = $Common::cgi->param('start');
	my $end      = $Common::cgi->param('end');
	my $location = $Common::cgi->param('location');

	# Check that the important stuff is here; give an error if it's not
	unless ($week && $event) {
		&error('Invalid request');
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
	$event    = &Common::trim($event);
	$location = &Common::trim($location);

	# Add the new record to the DB
	my $query = qq~
		INSERT INTO ${Config::db_prefix}todo
		(week, day, event, location, start, end)
		VALUES
		(?, ?, ?, ?, ?, ?)
	~;
	$Common::db->prepare($query);
	$Common::db->execute($week, $day, $event, $location, $start, $end);

	my $new_id = $Common::db->insert_id();

	$day = -1 if $origday eq '-';

	# Get the new item
	my $item = &get_item_by_id($new_id);

	# Output
	print $Common::cgi->header(-type => 'text/xml');
	print &Common::item_to_xml($item);
}

#######
## CHANGE DAY
#######
sub change_day()
{
	# Get CGI parameters
	my $id  = $Common::cgi->param('id');
	my $day = $Common::cgi->param('day');

	if ($day eq '8') {
		# Move to next week

		## Get item info
		my $query = qq~
			SELECT id, week
			FROM todo
			WHERE id = ?
		~;
		$Common::db->prepare($query);
		my $sth = $Common::db->execute($id);
		my $item = $sth->fetchrow_hashref();

		return unless ($item && $item->{'id'});

		## Get the week the item's currently in
		$query = qq~
			SELECT id, start, end
			FROM todo_weeks
			WHERE id = ?
		~;
		$Common::db->prepare($query);
		$sth = $Common::db->execute($item->{'week'});
		my $old_week = $sth->fetchrow_hashref();

		## Check if the next week already exists
		$query = qq~
			SELECT id, start, end
			FROM todo_weeks
			WHERE start = DATE_ADD(?, INTERVAL 1 DAY)
		~;
		$Common::db->prepare($query);
		$sth = $Common::db->execute($old_week->{'end'});
		my $new_week = $sth->fetchrow_hashref();

		unless ($new_week && $new_week->{'id'}) {
			$new_week = &Common::create_week_after($old_week);
			if ($Config::auto_load) {
				&Common::load_template($new_week->{'id'});
			}
		}

		## Update item
		$query = qq~
			UPDATE todo SET
				week = ?
			WHERE id = ?
		~;
		$Common::db->prepare($query);
		$Common::db->execute($new_week->{'id'}, $item->{'id'});
	} elsif ($day eq '-') {
		## Set to NULL

		# Update the record
		my $query = qq~
			UPDATE todo SET
				day = NULL
			WHERE id = ?
		~;
		$Common::db->prepare($query);
		$Common::db->execute($id);
	} else {
		# Update the record
		my $query = qq~
			UPDATE todo SET
				day = ?
			WHERE id = ?
		~;
		$Common::db->prepare($query);
		$Common::db->execute($day, $id);
	}

	my $item = &get_item_by_id($id);

	# Output
	print $Common::cgi->header(-type => 'text/xml');
	print &Common::item_to_xml($item);
}

#######
## MOVE UNFINISHED ITEMS
#######
sub move_unfinished()
{
	# Get CGI parameters
	my $week_id = $Common::cgi->param('week');

	# Get specified week
	my $query = qq~
		SELECT id, start, end
		FROM todo_weeks
		WHERE id = ?
	~;
	$Common::db->prepare($query);
	my $sth = $Common::db->execute($week_id);
	my $curr_week = $sth->fetchrow_hashref();

	unless ($curr_week && $curr_week->{'id'}) {
		return;
	}

	# Get ID of next week (create if necessary)
	$query = qq~
		SELECT id, start, end
		FROM todo_weeks
		WHERE start = DATE_ADD(?, INTERVAL 1 DAY)
	~;
	$Common::db->prepare($query);
	$sth = $Common::db->execute($curr_week->{'end'});
	my $next_week = $sth->fetchrow_hashref();

	unless ($next_week && $next_week->{'id'}) {
		$next_week = &Common::create_week_after($curr_week);
	}

	# Get all unfinished items for this week
	$query = qq~
		SELECT id
		FROM todo
		WHERE week = ? AND done = 0
	~;
	$Common::db->prepare($query);
	$sth = $Common::db->execute($week_id);

	# Move items to the next week
	$query = qq~
		UPDATE todo SET
			week = ?
		WHERE id = ?
	~;
	$Common::db->prepare($query);

	my @items;
	while (my $item = $sth->fetchrow_hashref()) {
		push @items, $item;
		$Common::db->execute($next_week->{'id'}, $item->{'id'});
	}

	# Load XML template
	my $xml = &Common::load_xml_template('moved');

	# Set template parameters
	$xml->param(items => \@items);

	# Output
	print $Common::cgi->header(-type => 'text/xml');
	print $xml->output();
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
	my $changed  = $Common::cgi->param('changed');
	my $id       = $Common::cgi->param('id');
	my $event    = $Common::cgi->param('event');
	my $location = $Common::cgi->param('location');
	my $start    = $Common::cgi->param('start');
	my $end      = $Common::cgi->param('end');

	if ($changed & 1) {
		# Trim spaces
		$event = &Common::trim($event);
		my $query = qq~
			UPDATE todo SET
				event = ?
			WHERE id = ?
		~;
		$Common::db->prepare($query);
		$Common::db->execute($event, $id);
	}

	if ($changed & 2) {
		undef $location unless $location;
		$location = &Common::trim($location);
		my $query = qq~
			UPDATE todo SET
				location = ?
			WHERE id = ?
		~;
		$Common::db->prepare($query);
		$Common::db->execute($location, $id);
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
		$Common::db->prepare($query);
		$Common::db->execute($start, $end, $id);
	}

	my $item = &get_item_by_id($id);

	print $Common::cgi->header(-type => 'text/xml');
	print &Common::item_to_xml($item);
}

#######
## DELETE ITEM
#######
sub delete_item()
{
	# Get CGI params
	my $id = $Common::cgi->param('id');

	# Delete the item
	my $query = qq~
		DELETE FROM todo
		WHERE id = ?
	~;
	$Common::db->prepare($query);
	$Common::db->execute($id);

	# No output necessary, except a header
	print $Common::cgi->header();
}

#######
## TOGGLE "DONE" STATE
#######
sub toggle_item_done()
{
	# Get CGI params
	my $id = $Common::cgi->param('id');

	# Get the item
	my $item = &get_item_by_id($id);

	$item->{'done'} = !$item->{'done'};

	# Update item
	my $query = qq~
		UPDATE todo SET
			done = ?
		WHERE id = ?
	~;
	$Common::db->prepare($query);
	$Common::db->execute($item->{'done'}, $id);

	# Output
	print $Common::cgi->header(-type => 'text/xml');
	print &Common::item_to_xml($item);
}

#######
## TOGGLE "MARKED" STATE
######
sub toggle_marked()
{
	# Get CGI params
	my $id = $Common::cgi->param('id');

	# Get the item
	my $item = &get_item_by_id($id);

	$item->{'mark'} = !$item->{'mark'};

	# Update item
	my $query = qq~
		UPDATE todo SET
			mark = ?
		WHERE id = ?
	~;
	$Common::db->prepare($query);
	$Common::db->execute($item->{'mark'}, $id);

	# Output
	print $Common::cgi->header(-type => 'text/xml');
	print &Common::item_to_xml($item);	
}

#######
## GET ITEM (BY ID)
#######
sub get_item_by_id()
{
	my $id = shift;

	# Load the item
	my $query = qq~
		SELECT t.id, t.week, t.day, t.event, t.location, t.start, t.end, t.done, t.mark, DATE_ADD(tw.start, INTERVAL (t.day - 1) DAY) AS date, IF(tw.start, 0, 1) AS template
		FROM todo t
		LEFT JOIN todo_weeks tw ON tw.id = t.week
		WHERE t.id = ?
	~;
	$Common::db->prepare($query);
	my $sth = $Common::db->execute($id);

	my $item = $sth->fetchrow_hashref();

	if (!$item->{'template'} && $item->{'day'} ne '--') {
		my ($year, $month, $day) = split(/-/, $item->{'date'});
		$item->{'date'} = strftime($Config::date_format, 0, 0, 0, $day, $month - 1, $year - 1900);
	}

	return $item;
}

#######
## ERROR
#######
sub error()
{
	my $msg = shift;

	# Load XML template
	my $xml = &Common::load_xml_template('error');

	# Set template params
	$xml->param(msg => $msg);

	# Output
	print $Common::cgi->header( -type => 'text/xml' );
	print $xml->output();

	exit;
}
