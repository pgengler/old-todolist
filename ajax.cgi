#!/usr/bin/perl

use strict;

use Common;
use JSON;
use POSIX;

require 'config.pl';

my $action = $Common::cgi->param('action');

my %actions = (
	'add'        => \&add_new_item,
	'day'        => \&change_day,
	'date'       => \&change_date,
	'save'       => \&save_item,
	'done'       => \&toggle_item_done,
	'delete'     => \&delete_item,
	'mark'       => \&toggle_marked,
	'load'       => \&list_items,
	'additemtag' => \&add_item_tag,
	'delitemtag' => \&remove_item_tag,
	'itemtags'   => \&update_item_tags,
	'addtag'     => \&add_tag,
	'savetag'    => \&save_tag,
	'removetag'  => \&remove_tag
);

if ($action && $actions{ $action }) {
	$actions{ $action }->();
}

##############

#######
## ADD NEW ITEM
#######

sub add_new_item()
{
	# Get CGI parameters
	my $date     = $Common::cgi->param('date');
	my $event    = $Common::cgi->param('event');
	my $start    = $Common::cgi->param('start');
	my $end      = $Common::cgi->param('end');
	my $location = $Common::cgi->param('location');
	my $view     = $Common::cgi->param('view');

	# Check that the important stuff is here; give an error if it's not
	unless ($event) {
		&error('Invalid request');
	}

	if (!$view || $view ne 'template') {
		if ($date && $date !~ /^\d{4}-\d{2}-\d{2}$/) {
			$date = '';
		}
	}

	# Turn empty strings into NULLs for the database
	undef $start unless $start;
	undef $end unless $end;
	undef $location unless $location;
	undef $date unless $date;

	# Remove leading and trailing spaces
	$event    = &Common::trim($event);
	$location = &Common::trim($location);

	# Add the new record to the DB
	if ($view && $view eq 'template') {
		$date = int($date);
		my $query = qq~
			INSERT INTO ${Config::db_prefix}template_items
			(day, event, location, start, "end", "timestamp")
			VALUES
			(?, ?, ?, ?, ?, UNIX_TIMESTAMP())
		~;
		$Common::db->statement($query)->execute($date >= 0 ? $date : undef, $event, $location, $start, $end);
	} else {
		my $query = qq~
			INSERT INTO ${Config::db_prefix}todo
			(date, event, location, start, "end", "timestamp")
			VALUES
			(?, ?, ?, ?, ?, UNIX_TIMESTAMP())
		~;
		$Common::db->statement($query)->execute($date, $event, $location, $start, $end);
	}

	&list_items();
}

#######
## CHANGE DAY
#######
sub change_day()
{
	# Get CGI parameters
	my $id   = int($Common::cgi->param('id'));
	my $day  = int($Common::cgi->param('day'));
	my $view = $Common::cgi->param('view');

	if ($view eq 'template') {
		&template_change_day($id, $day);
		return;
	}

	my $item = &get_item_by_id($id);
	return unless ($item && $item->{'id'});
	if ($day == -1) {
		# Remove date
		my $query = qq~
			UPDATE todo SET
				date      = NULL,
				timestamp = UNIX_TIMESTAMP()
			WHERE id = ?
		~;
		$Common::db->statement($query)->execute($item->{'id'});
	} else {
		$item->{'day'} = -1 unless defined($item->{'day'});

		if (defined($item->{'date'})) {
			# Update the record
			my $query = qq~
				UPDATE todo SET
					date        = DATE_ADD("date", INTERVAL ? DAY),
					"timestamp" = UNIX_TIMESTAMP()
				WHERE id = ?
			~;
			$Common::db->statement($query)->execute($day == 8 ? 7 : ($day - $item->{'day'} + 1), $item->{'id'});
		} else {
			my $query = qq~
				UPDATE todo SET
					date        = DATE_ADD(DATE_SUB(?, INTERVAL DAYOFWEEK(?) - 1 DAY), INTERVAL ? DAY),
					"timestamp" = UNIX_TIMESTAMP()
				WHERE id = ?
			~;
			$Common::db->statement($query)->execute($view, $view, $day, $item->{'id'});
		}
	}

	&list_items();
}

sub template_change_day()
{
	my ($id, $day) = @_;

	# Get item
	my $item = &get_template_item($id);

	if ($day >= 0 && $day <= 6) {
		# Update day
		my $query = qq~
			UPDATE template_items SET
				day         = ?,
				"timestamp" = UNIX_TIMESTAMP()
			WHERE id = ?
		~;
		$Common::db->statement($query)->execute($day, $id);
	} else {
		# No day
		my $query = qq~
			UPDATE template_items SET
				day         = NULL,
				"timestamp" = UNIX_TIMESTAMP()
			WHERE id = ?
		~;
		$Common::db->statement($query)->execute($id);
	}
	&list_items();
}

#######
## CHANGE DATE
#######
sub change_date()
{
	# Get CGI parameters
	my $id   = $Common::cgi->param('id');
	my $date = $Common::cgi->param('date');

	# Validate that date is in the right format
	unless ($date =~ /^\d{4}-\d{2}-\d{2}$/) {
		$date = '';
	}

	my $item = &get_item_by_id($id);
	return unless ($item && $item->{'id'});

	# Update the record
	my $query = qq~
		UPDATE todo SET
			date        = ?,
			"timestamp" = UNIX_TIMESTAMP()
		WHERE id = ?
	~;
	$Common::db->statement($query)->execute($date ? $date : undef, $item->{'id'});

	&list_items();
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
	my $view     = $Common::cgi->param('view');

	my $table    = 'todo';
	if ($view && $view eq 'template') {
		$table = 'template_items';
	}

	if ($changed & 1) {
		# Trim spaces
		$event = &Common::trim($event);
		my $query = qq~
			UPDATE $table SET
				event       = ?,
				"timestamp" = UNIX_TIMESTAMP()
			WHERE id = ?
		~;
		$Common::db->statement($query)->execute($event, $id);
	}

	if ($changed & 2) {
		undef $location unless $location;
		$location = &Common::trim($location);
		my $query = qq~
			UPDATE $table SET
				location    = ?,
				"timestamp" = UNIX_TIMESTAMP()
			WHERE id = ?
		~;
		$Common::db->statement($query)->execute($location, $id);
	}

	if ($changed & 4) {
		undef $start unless $start;
		undef $end unless $end;
		my $query = qq~
			UPDATE $table SET
				start       = ?,
				"end"       = ?,
				"timestamp" = UNIX_TIMESTAMP()
			WHERE id = ?
		~;
		$Common::db->statement($query)->execute($start, $end, $id);
	}

	&list_items();
}

#######
## DELETE ITEM
#######
sub delete_item()
{
	# Get CGI params
	my $id    = $Common::cgi->param('id');
	my $view  = $Common::cgi->param('view');

	my $item_table = 'todo';
	my $tags_table = 'item_tags';

	if ($view && $view eq 'template') {
		$item_table = 'template_items';
		$tags_table = 'template_item_tags';
	}

	# Start a transaction
	$Common::db->start_transaction();

	# Remove any tags from this item
	my $query = qq~
		DELETE FROM $tags_table
		WHERE item_id = ?
	~;
	$Common::db->statement($query)->execute($id);

	# Now mark the item as deleted
	$query = qq~
		UPDATE $item_table
		SET
			deleted     = 1,
			"timestamp" = UNIX_TIMESTAMP()
		WHERE id = ?
	~;
	$Common::db->statement($query)->execute($id);

	# If we made it this far without errors, commit the transaction
	$Common::db->commit_transaction();

	&list_items();
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
			done        = ?,
			keep_until  = IF(?, DATE_ADD(NOW(), INTERVAL 1 DAY), NULL),
			"timestamp" = UNIX_TIMESTAMP()
		WHERE id = ?
	~;
	$Common::db->statement($query)->execute($item->{'done'}, $item->{'done'}, $id);

	&list_items();
}

#######
## TOGGLE "MARKED" STATE
######
sub toggle_marked()
{
	# Get CGI params
	my $id    = $Common::cgi->param('id');
	my $view  = $Common::cgi->param('view');

	my $table = 'todo';
	my $item;

	# Get the item
	if ($view && $view eq 'template') {
		$table = 'template_items';
		$item  = &get_template_item($id);
	} else {
		$item = &get_item_by_id($id);
	}

	$item->{'mark'} = !$item->{'mark'};

	# Update item
	my $query = qq~
		UPDATE $table SET
			mark        = ?,
			"timestamp" = UNIX_TIMESTAMP()
		WHERE id = ?
	~;
	$Common::db->statement($query)->execute($item->{'mark'}, $id);

	&list_items();
}

#######
## GET ITEM (BY ID)
#######
sub get_item_by_id()
{
	my $id = shift;

	# Load the item
	my $query = qq~
		SELECT t.id, t.event, t.location, t.start, t.end, t.done, t.mark, t.date, DAYOFWEEK(t.date) "day"
		FROM todo t
		WHERE t.id = ?
	~;
	my $item = $Common::db->statement($query)->execute($id)->fetch;

	# Get tags
	$query = qq~
		SELECT t.id, t.name, t.style
		FROM tags t
		LEFT JOIN item_tags it ON it.tag_id = t.id
		WHERE it.item_id = ? AND t.active = 1
		ORDER BY t.name
	~;
	$item->{'tags'} = $Common::db->statement($query)->execute($item->{'id'})->fetchall;

	return $item;
}

#######
## GET TEMPLATE ITEM (BY ID)
#######
sub get_template_item()
{
	my $id = shift;

	my $query = qq~
		SELECT id, day, event, location, start, end, mark
		FROM template_items
		WHERE id = ?
	~;
	my $item = $Common::db->statement($query)->execute($id)->fetch;

	return undef unless ($item && $item->{'id'});

	# Get tags
	$query = qq~
		SELECT t.id, t.name, t.style
		FROM tags t
		LEFT JOIN template_item_tags tt ON tt.tag_id = t.id
		WHERE tt.item_id = ? AND t.active = 1
		ORDER BY t.name
	~;
	$item->{'tags'} = $Common::db->statement($query)->execute($item->{'id'})->fetchall;

	return $item;
}

#######
## ERROR
#######
sub error()
{
	my $msg = shift;

	Common::output_json({ 'error' => $msg });

	exit;
}

#######
## LIST ITEMS
#######
sub list_items()
{
	# Get parameters
	my $view = shift || $Common::cgi->param('view');
	my $timestamp = $Common::cgi->param('timestamp') ? int($Common::cgi->param('timestamp')) : 0;

	if (!$view || ($view !~ /^\d{4}-\d{2}-\d{2}$/ && $view ne 'template')) {
		undef $view;
	}

	my $statement;

	my $excl_deleted = ($timestamp > 0) ? '' : 'AND deleted IS NULL';

	if ($view eq 'template') {
		# Load template items
		my $query = qq~
			SELECT id, IF(day IS NOT NULL, day, ?) day, event, location, start, end, mark, deleted, "timestamp"
			FROM template_items
			WHERE "timestamp" >= ? AND deleted IS NULL
			ORDER BY day, start, "end"
		~;
		$statement = $Common::db->statement($query)->execute($Config::undated_last ? 7 : -1, $timestamp);
	} elsif ($view) {
		my ($year, $month, $day) = split(/-/, $view);
		my $unixtime = mktime(0, 0, 0, int($day), int($month) - 1, int($year) - 1900);
		my @parts = localtime($unixtime);
		my $weekday = $parts[6];

		for (my $i = 0; $i < 7; $i++) {
			my $offset = ($i - $weekday) * 60 * 60 * 24;
			my $date = strftime('%Y-%m-%d', localtime($unixtime + $offset));

			unless (&Common::template_loaded($date)) {
				&Common::load_template($date);
			}
		}

		# Get all items in the same week as the given date
		my $query = qq~
			SELECT t.id, t.event, t.location, t.start, t.end, t.done, t.mark, t.date, t.deleted, t.timestamp
			FROM todo t
			WHERE
				(
					(t.date >= DATE_SUB(?, INTERVAL (DAYOFWEEK(?) - 1) DAY))
					AND
					(t.date <= DATE_ADD(?, INTERVAL (7 - DAYOFWEEK(?)) DAY))
					OR
					(t.date IS NULL AND (t.done = 0 OR t.keep_until > NOW()))
				) AND timestamp >= ? $excl_deleted
			ORDER BY "date", t.start, t.end, t.event, t.done
		~;
		$statement = $Common::db->statement($query)->execute($view, $view, $view, $view, $timestamp);
	} else {
		# Load template for any days that aren't covered
		my $unixdate = time();
		for (my $i = 0; $i < 7; $i++, $unixdate += (60 * 60 * 24)) {
			my $date = strftime('%Y-%m-%d', localtime($unixdate));

			unless (&Common::template_loaded($date)) {
				&Common::load_template($date);
			}
		}

		# Get all unfinished items older than today, plus all items within six days of today
		my $query = qq~
			SELECT t.id, t.event, t.location, t.start, t.end, t.done, t.mark, t.date, t.keep_until, t.deleted, t.timestamp
			FROM todo t
			WHERE
				(
					(t.done = 1 AND t.keep_until > NOW())
					OR
					(t.done = 0 AND "date" < DATE_ADD(NOW(), INTERVAL 6 DAY))
					OR
					(t.done = 0 AND "date" IS NULL)
				) AND timestamp >= ? $excl_deleted
			ORDER BY "date", start, end, event, done
		~;
		$statement = $Common::db->statement($query)->execute($timestamp);
	}

	my @items;

	my $table = ($view eq 'template') ? 'template_item_tags' : 'item_tags';
	my $query = qq~
		SELECT t.id
		FROM tags t
		LEFT JOIN $table it ON it.tag_id = t.id
		WHERE it.item_id = ? AND t.active = 1
		ORDER BY t.name
	~;
	my $get_tags = $Common::db->statement($query);

	my $max_timestamp = 0;
	while (my $item = $statement->fetch) {
		unless ($Config::use_mark) {
			$item->{'mark'} = 0;
		}
		$max_timestamp = $item->{'timestamp'} if ($item->{'timestamp'} > $max_timestamp);

		if ($item->{'keep_until'}) {
			$item->{'keep_until'} = s/ /T/;
		}

		my $tags = $get_tags->execute($item->{'id'})->fetchall;
		$item->{'tags'} = [ map { $_->{'id'} } @$tags ];

		push @items, $item;
	}

	my $output_vars = {
		'items'     => \@items,
		'tags'      => get_tags(),
		'timestamp' => ($max_timestamp || $timestamp),
	};
	if ($timestamp == 0) {
		$output_vars->{'full'} = JSON::true;
	}
	if ($view && $view eq 'template') {
		$output_vars->{'template'} = JSON::true;
	}

	Common::output_json($output_vars);
}

sub get_tags()
{
	my $query = qq~
		SELECT id, name, style
		FROM tags
		WHERE active = 1
		ORDER BY name
	~;
	my $tags = $Common::db->statement($query)->execute->fetchall;

	return $tags;
}

sub add_item_tag()
{
	my $item_id = int($Common::cgi->param('item'));
	my $tag_id  = int($Common::cgi->param('tag'));
	my $view    = $Common::cgi->param('view');

	my ($item, $table) = (undef, 'item_tags');

	if ($view && $view eq 'template') {
		$table = 'template_item_tags';
		$item = &get_template_item($item_id);
	} else {
		$item = &get_item_by_id($item_id);
	}

	# Error if item is invalid
	unless ($item && $item->{'id'}) {
		&error("Invalid item");
	}

	# Add tag to item
	my $sql = qq~
		INSERT INTO $table
		(item_id, tag_id)
		VALUES
		(?, ?)
	~;
	$Common::db->statement($sql)->execute($item_id, $tag_id);

	# Update item timestamp
	$table = ($view && $view eq 'template') ? 'template_items' : 'todo';
	$sql = qq~
		UPDATE $table
		SET
			"timestamp" = UNIX_TIMESTAMP()
		WHERE id = ?
	~;
	$Common::db->statement($sql)->execute($item->{'id'});

	&list_items();
}

sub remove_item_tag()
{
	my $item_id = int($Common::cgi->param('item'));
	my $tag_id  = int($Common::cgi->param('tag'));
	my $view    = $Common::cgi->param('view');

	my ($item, $table) = (undef, 'item_tags');

	if ($view && $view eq 'template') {
		$table = 'template_item_tags';
		$item = &get_template_item($item_id);
	} else {
		$item = &get_item_by_id($item_id);
	}

	# Error if item is invalid
	unless ($item && $item->{'id'}) {
		&error("Invalid item");
	}

	# Remove tag from item
	my $sql = qq~
		DELETE FROM $table
		WHERE item_id = ? AND tag_id = ?
	~;
	$Common::db->statement($sql)->execute($item_id, $tag_id);

	# Update item timestamp
	$table = ($view && $view eq 'template') ? 'template_items' : 'todo';
	$sql = qq~
		UPDATE $table
		SET
			"timestamp" = UNIX_TIMESTAMP()
		WHERE id = ?
	~;
	$Common::db->statement($sql)->execute($item->{'id'});

	&list_items();
}

sub update_item_tags()
{
	# Get CGI params
	my $item_id   = $Common::cgi->param('id');
	my $item_tags = $Common::cgi->param('tags');
	my $view      = $Common::cgi->param('view');

	my ($item, $table) = (undef, 'item_tags');

	if ($view && $view eq 'template') {
		$table = 'template_item_tags';
		$item  = &get_template_item($item_id);
	} else {
		$item  = &get_item_by_id($item_id);
	}

	# Make sure item exists
	unless ($item && $item->{'id'}) {
		&error('Invalid item');
	}

	# Start transaction to ensure consistency
	$Common::db->start_transaction();

	# Remove all current tags for the item
	my $query = qq~
		DELETE FROM $table
		WHERE item_id = ?
	~;
	$Common::db->statement($query)->execute($item->{'id'});

	# Split tags param into parts
	my @tags = split(/,/, $item_tags);

	# Add tags, if any
	if (scalar(@tags) > 0) {
		$query = qq~
			INSERT INTO $table
			(item_id, tag_id)
			VALUES
			(?, ?)
		~;
		my $add_tag_to_item = $Common::db->statement($query);

		foreach my $tag (@tags) {
			$add_tag_to_item->execute($item->{'id'}, $tag);
		}
	}

	# Update item timestamp
	$table = ($view && $view eq 'template') ? 'template_items' : 'todo';
	$query = qq~
		UPDATE $table
		SET
			"timestamp" = UNIX_TIMESTAMP()
		WHERE id = ?
	~;
	$Common::db->statement($query)->execute($item->{'id'});

	$Common::db->commit_transaction();

	&list_items();
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
	$Common::db->statement($query)->execute($name, $style);

	&list_tags();
}

#######
## REMOVE TAG
#######
sub remove_tag()
{
	# Get CGI params
	my $tag_id  = $Common::cgi->param('id');

	# Mark as inactive (so it's not used; effectively the same as doing a DELETE)
	my $query = qq~
		UPDATE tags
		SET active = 0
		WHERE id = ?
	~;
	$Common::db->statement($query)->execute($tag_id);

	&list_items();
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
		$Common::db->statement($query)->execute($name, $tag_id);
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
		$Common::db->statement($query)->execute($style, $tag_id);
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
	my $tags = $Common::db->statement($query)->execute->fetchall;

	Common::output_json($tags);
}
