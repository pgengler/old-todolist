#!/usr/bin/perl -w

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
	'add'       => \&add_new_item,
	'day'       => \&change_day,
	'save'      => \&save_item,
	'done'      => \&toggle_item_done,
	'delete'    => \&delete_item,
	'mark'      => \&toggle_marked,
	'move'      => \&move_unfinished,
	'load'      => \&list_items,
	'itemtags'  => \&update_item_tags,
	'addtag'    => \&add_tag,
	'savetag'   => \&save_tag,
	'removetag' => \&remove_tag
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

	&list_items($week);
}

#######
## CHANGE DAY
#######
sub change_day()
{
	# Get CGI parameters
	my $id  = $Common::cgi->param('id');
	my $day = $Common::cgi->param('day');

	my $item = &get_item_by_id($id);
	return unless ($item && $item->{'id'});

	if ($day eq '8') {
		# Move to next week

		## Get the week the item's currently in
		my $query = qq~
			SELECT id, start, end
			FROM todo_weeks
			WHERE id = ?
		~;
		$Common::db->prepare($query);
		my $sth = $Common::db->execute($item->{'week'});
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

	&list_items($item->{'week'});
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

	&list_items($curr_week->{'id'});
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

	&list_items($item->{'week'});
}

#######
## DELETE ITEM
#######
sub delete_item()
{
	# Get CGI params
	my $id = $Common::cgi->param('id');

	my $item = &get_item_by_id($id);

	# Delete the item
	my $query = qq~
		DELETE FROM todo
		WHERE id = ?
	~;
	$Common::db->prepare($query);
	$Common::db->execute($id);

	&list_items($item->{'week'});
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

	&list_items($item->{'week'});
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

	&list_items($item->{'week'});
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

	# Get tags
	$query = qq~
		SELECT t.id, t.name, t.style
		FROM tags t
		LEFT JOIN item_tags it ON it.tag_id = t.id
		WHERE it.item_id = ? AND t.active = 1
		ORDER BY t.name
	~;
	$Common::db->prepare($query);
	$sth = $Common::db->execute($item->{'id'});

	my @tags;
	while (my $tag = $sth->fetchrow_hashref()) {
		push @tags, $tag;
	}
	$item->{'tags'} = \@tags;

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
	&Common::output($xml, 1);

	exit;
}

#######
## LIST ITEMS
#######
sub list_items()
{
	# Get parameters
	my $week_id = shift || $Common::cgi->param('week');

	# Load items
	my $query = qq~
		SELECT t.id, IF(t.day, t.day, ?) day, t.event, t.location, t.start, t.end, t.done, t.mark, DATE_ADD(tw.start, INTERVAL (t.day - 1) DAY) AS date
		FROM todo t
		LEFT JOIN todo_weeks tw ON tw.id = t.week
		WHERE week = ?
		ORDER BY day, t.start, t.end, t.event, t.done
	~;
	$Common::db->prepare($query);
	my $sth = $Common::db->execute($Config::undated_last ? 7 : -1, $week_id);

	my @items;

	$query = qq~
		SELECT t.id
		FROM tags t
		LEFT JOIN item_tags it ON it.tag_id = t.id
		WHERE it.item_id = ? AND t.active = 1
		ORDER BY t.name
	~;
	$Common::db->prepare($query);

	while (my $item = $sth->fetchrow_hashref()) {
		if ($Config::show_date) {
			if ($item->{'day'} < 0 || $item->{'day'} > 6) {
				undef $item->{'date'};
			} else {
				my ($year, $month, $day) = split(/-/, $item->{'date'});
				$item->{'date'} = strftime($Config::date_format, 0, 0, 0, $day, $month - 1, $year - 1900);
			}
		} else {
			undef $item->{'date'};
		}

		unless ($Config::use_mark) {
			$item->{'mark'} = 0;
		}

		my $sth = $Common::db->execute($item->{'id'});
		my @tags;

		while (my $tag = $sth->fetchrow_hashref()) {
			push @tags, $tag;
		}
		$item->{'tags'} = \@tags;

		push @items, $item;
	}

	# Load XML template
	my $xml = &Common::load_xml_template('items');

	# Set template params
	$xml->param(week  => $week_id);
	$xml->param(items => \@items);
	$xml->param(tags  => &get_tags());

	# Output
	&Common::output($xml, 1);
}

sub get_tags()
{
	my $query = qq~
		SELECT id, name, style
		FROM tags
		WHERE active = 1
		ORDER BY name
	~;
	$Common::db->prepare($query);
	my $sth = $Common::db->execute();

	my @tags;

	while (my $tag = $sth->fetchrow_hashref()) {
		push @tags, $tag;
	}

	return \@tags;
}

sub update_item_tags()
{
	# Get CGI params
	my $item_id   = $Common::cgi->param('id');
	my $item_tags = $Common::cgi->param('tags');

	# Make sure item exists
	my $item = &get_item_by_id($item_id);
	unless ($item && $item->{'id'}) {
		&error('Invalid item');
	}

	# Start transaction to ensure consistency
	$Common::db->start_transaction();

	# Remove all current tags for the item
	my $query = qq~
		DELETE FROM item_tags
		WHERE item_id = ?
	~;
	$Common::db->prepare($query);
	$Common::db->execute($item->{'id'});

	# Split tags param into parts
	my @tags = split(/,/, $item_tags);

	# Add tags, if any
	if (scalar(@tags) > 0) {
		$query = qq~
			INSERT INTO item_tags
			(item_id, tag_id)
			VALUES
			(?, ?)
		~;
		$Common::db->prepare($query);

		foreach my $tag (@tags) {
			$Common::db->execute($item->{'id'}, $tag);
		}
	}
	$Common::db->commit_transaction();

	&list_items($item->{'week'});
}

#######
## ADD TAG
#######
sub add_tag()
{
	# Get CGI params
	my $name  = $Common::cgi->param('name');
	my $style = $Common::cgi->param('style');

	# TODO: Check for valid values

	my $query = qq~
		INSERT INTO tags
		(name, style)
		VALUES
		(?, ?)
	~;
	$Common::db->prepare($query);
	$Common::db->execute($name, $style);

	&list_tags();	
}

#######
## REMOVE TAG
#######
sub remove_tag()
{
	# Get CGI params
	my $week_id = $Common::cgi->param('week');
	my $tag_id  = $Common::cgi->param('id');

	# Mark as inactive (so it's not used; effectively the same as doing a DELETE)
	my $query = qq~
		UPDATE tags
		SET active = 0
		WHERE id = ?
	~;
	$Common::db->prepare($query);
	$Common::db->execute($tag_id);

	&list_items($week_id);
}

#######
## SAVE TAG
#######
sub save_tag()
{
	# Get CGI params
	my $tag_id = $Common::cgi->param('id');
	my $name   = $Common::cgi->param('name');
	my $style  = $Common::cgi->param('style');

	if ($name) {
		my $query = qq~
			UPDATE tags
			SET name = ?
			WHERE id = ?
		~;
		$Common::db->prepare($query);
		$Common::db->execute($name, $tag_id);
	}
	if ($style) {
		if (int($style) == -1) {
			$style = 0;
		}
		my $query = qq~
			UPDATE tags
			SET style = ?
			WHERE id = ?
		~;
		$Common::db->prepare($query);
		$Common::db->execute($style, $tag_id);
	}

	&list_tags();
}

#######
## LIST TAGS
#######
sub list_tags()
{
	my $query = qq~
		SELECT id, name, style
		FROM tags
		WHERE active = 1
		ORDER BY name
	~;
	$Common::db->prepare($query);
	my $sth = $Common::db->execute();

	my @tags;

	while (my $tag = $sth->fetchrow_hashref()) {
		push @tags, $tag;
	}

	# Load XML template
	my $xml = &Common::load_xml_template('tags');

	# Set template params
	$xml->param(tags => \@tags);

	# Output
	&Common::output($xml, 1);
}
