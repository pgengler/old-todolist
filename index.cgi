#!/usr/bin/perl

use strict;

use CGI;
use Database;
use HTML::Template;
use POSIX;

require 'config.pl';

my $cgi = new CGI;
my $db = new Database;
$db->init($Config::db_user, $Config::db_pass, $Config::db_name);

my $action = $cgi->param('act');

my %actions = (
	'template' => \&load_template,
	'view'     => \&show_list
);

if ($actions{ $action }) {
	$actions{ $action }->();
} else {
	&show_list();
}

sub show_list()
{
	# Load HTML template
	my $html = new HTML::Template(filename => 'todo.tmpl', global_vars => 1, loop_context_vars => 1);

	# Get CGI params
	my $day = $cgi->param('day');
	my $week;

	if ($day eq 'template') {
		# Load the template

		my $query = qq~
			SELECT id
			FROM todo_weeks
			WHERE start IS NULL AND end IS NULL
		~;
		$db->prepare($query);
		my $sth = $db->execute();

		$week = $sth->fetchrow_hashref();

		$Config::show_date = 0;
	} elsif ($day) {
		# Load the specified week with that day
		my $query = qq~
			SELECT id, start
			FROM todo_weeks
			WHERE start <= ? AND end >= ?
		~;
		$db->prepare($query);
		my $sth = $db->execute($day, $day);

		$week = $sth->fetchrow_hashref();

		unless ($week) {
			$week = &create_week($day);
		}

		my $year  = substr($week->{'start'}, 0, 4);
		my $month = substr($week->{'start'}, 5, 2);
		my $day   = substr($week->{'start'}, 8, 2);
		$week->{'time'} = mktime(0, 0, 0, $day, $month - 1, $year - 1900, 0, 0);
	} else {
		# Figure out what the current week is
		my $query = qq~
			SELECT id, start
			FROM todo_weeks
			WHERE start <= CURDATE() AND end >= CURDATE()
		~;
		$db->prepare($query);
		my $sth = $db->execute();

		$week = $sth->fetchrow_hashref();

		my ($year, $month, $day);

		unless ($week) {
			# Get the current day of the week
			my @parts = localtime(time);
			my $wday  = $parts[6];

			# Now get the first day of this week
			@parts    = localtime(time - ($wday * 24 * 60 * 60));
			$year     = $parts[5] + 1900;
			$month    = &fix_date($parts[4] + 1);
			$day      = &fix_date($parts[3]);
			$week     = &create_week("$year$month$day");
		} else {
			# Get component parts of start date
			$year  = substr($week->{'start'}, 0, 4);
			$month = substr($week->{'start'}, 5, 2);
			$day   = substr($week->{'start'}, 8, 2);
		}
		$week->{'time'} = mktime(0, 0, 0, $day, $month - 1, $year - 1900, 0, 0);

		# For some reason, mktime() likes to give us the time 1hr later than it actually is.
		$week->{'time'} -= 3600;
	}

	# Find the start date of the previous week
	my $seven_days = 7 * 24 * 60 * 60;	# number of seconds in 7 days

	my @prev_week = localtime($week->{'time'} - $seven_days);

	my $prev_week = (1900 + $prev_week[5]) . &fix_date($prev_week[4] + 1) . &fix_date($prev_week[3]);
	my $prev_week_display = (1900 + $prev_week[5]) . '-' . &fix_date($prev_week[4] + 1) . '-' . &fix_date($prev_week[3]);

	# Find the start date of the next week
	my @next_week = localtime($week->{'time'} + $seven_days);

	my $next_week = (1900 + $next_week[5]) . &fix_date($next_week[4] + 1) . &fix_date($next_week[3]);
	my $next_week_display = (1900 + $next_week[5]) . '-' . &fix_date($next_week[4] + 1) . '-' . &fix_date($next_week[3]);

	if ($day ne 'template') {
		$html->param(week_start => $week->{'start'});
		$html->param(week_id    => $week->{'id'});
		$html->param(prev_week  => $prev_week);
		$html->param(next_week  => $next_week);
		$html->param(prev_week_display => $prev_week_display);
		$html->param(next_week_display => $next_week_display);

		if (time() >= $week->{'time'} && time() < ($week->{'time'} + $seven_days)) {
			$html->param(current_week => 1);
		}

		my @dates;
		for (my $i = 0; $i < 7; $i++) {
			my $time = $week->{'time'} + ($i * 24 * 60 * 60);
			my @parts = localtime($time);
			my $month = $parts[4] + 1;
			my $day   = &fix_date($parts[3]);

			push @dates, {
				'date' => "$month/$day"
			};
		}
		$html->param(dates    => \@dates);
	} else {
		$html->param(week_id  => $week->{'id'});
		$html->param(template => 1);
	}

	# Get all items for the current week
	my $query = qq~
		SELECT t.id, IF(t.day, t.day, ?) day, t.event, t.location, t.start, t.end, t.done, t.mark, DATE_ADD(tw.start, INTERVAL (t.day - 1) DAY) AS date
		FROM todo t
		LEFT JOIN todo_weeks tw ON tw.id = t.week
		WHERE week = ?
		ORDER BY day, t.start, t.end, t.event, t.done
	~;
	$db->prepare($query);
	my $sth = $db->execute($Config::undated_last ? 7 : -1, $week->{'id'});

	my @events;

	while (my $event = $sth->fetchrow_hashref()) {
		$event->{'day'} = &get_day_name($event->{'day'});
		$event->{'mark_css'} = ($event->{'mark'} && !$event->{'done'});
		if ($Config::show_date) {
			if ($event->{'day'} eq '--') {
				undef $event->{'date'};
			} else {
				my ($year, $month, $day) = split(/-/, $event->{'date'});
				$event->{'date'} = ', ' . &get_month_name($month) . ' ' . $day;
			}
		} else {
			undef $event->{'date'};
		}
		push @events, $event;
	}

	$html->param(events    => \@events);
	$html->param(url       => $Config::url);
	$html->param(show_date => $Config::show_date);
	$html->param(use_mark  => $Config::use_mark);

	# Output
	print $cgi->header();
	print $html->output();
}

#######
## LOAD TEMPLATE
## Loads the template into the specified week
#######
sub load_template()
{
	# Get CGI parameters
	my $week_id = $cgi->param('week');

	my $week;

	unless ($week_id) {
		# use current date if none is given
		my @date_parts = localtime(time());

		my $day = ($date_parts[5] + 1900) . &fix_date($date_parts[4] + 1) . &fix_date($date_parts[3]);

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
			$week = &create_week($day);
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

	# $week->{'start'} comes with hyphens that we don't want
	my @parts = split(/-/, $week->{'start'});
	$week->{'start'} = join('', @parts);

	# Now, output the list as usual
	print $cgi->redirect($Config::url . $week->{'start'} . '/');
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
