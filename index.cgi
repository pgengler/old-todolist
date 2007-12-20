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
	my $html = new HTML::Template(filename => 'todo.tmpl');

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
			WHERE start <= NOW() AND end >= NOW()
		~;
		$db->prepare($query);
		my $sth = $db->execute();

		$week = $sth->fetchrow_hashref();

		# Get component parts of start date
		my $year  = substr($week->{'start'}, 0, 4);
		my $month = substr($week->{'start'}, 5, 2);
		my $day   = substr($week->{'start'}, 8, 2);

		$week->{'time'} = mktime(0, 0, 0, $day, $month - 1, $year - 1900, 0, 0);
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
	} else {
		$html->param(week_id  => $week->{'id'});
		$html->param(template => 1);
	}

	# Get all items for the current week
	my $query = qq~
		SELECT id, day, event, location, start, end, done
		FROM todo
		WHERE week = ?
		ORDER BY day, start, event, done
	~;
	$db->prepare($query);
	my $sth = $db->execute($week->{'id'} || 1);

	my @events;

	while (my $event = $sth->fetchrow_hashref()) {
		my %event_info;

		$event->{'event'} =~ s/</&lt;/g;
		$event->{'event'} =~ s/>/&gt;/g;
		$event->{'location'} =~ s/&/&amp;/g;
		$event->{'location'} =~ s/</&lt;/g;
		$event->{'location'} =~ s/>/&gt;/g;

		$event_info{'day_name'} = &get_day_name($event->{'day'});
		$event_info{'id'}       = $event->{'id'};
		$event_info{'event'}    = $event->{'event'};
		$event_info{'start'}    = $event->{'start'};
		$event_info{'end'}      = $event->{'end'};
		$event_info{'done'}     = $event->{'done'};
		$event_info{'location'} = $event->{'location'};

		push @events, \%event_info;
	}

	$html->param(events => \@events);
	$html->param(url    => $Config::url);

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
		SELECT id, day, event, location, start, end, done
		FROM todo
		WHERE week = ?
	~;
	$db->prepare($query);
	$sth = $db->execute($template_week->{'id'});

	# Add the items to the specified week
	$query = qq~
		INSERT INTO todo
		(week, day, event, location, start, end, done)
		VALUES
		(?, ?, ?, ?, ?, ?, ?)
	~;
	$db->prepare($query);

	while (my $item = $sth->fetchrow_hashref()) {
		$db->execute($week->{'id'}, $item->{'day'}, $item->{'event'}, $item->{'location'}, $item->{'start'}, $item->{'end'}, $item->{'done'});
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

	return '--' unless defined($day);

	my @days = ( 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' );

	return $days[$day];
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
	my $end_date = $unix_date + (6 * 24 * 60 * 60);

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
