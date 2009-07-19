#!/usr/bin/perl

#######
## PERL SETUP
#######
use strict;

#######
## INCLUDES
#######
use Common;
use POSIX;

#######
## DISPATCHING
#######
my $action = $Common::cgi->param('act');

my %actions = (
	'template' => \&load_template,
	'view'     => \&show_list
);

if ($actions{ $action }) {
	$actions{ $action }->();
} else {
	&show_list();
}

##############

sub show_list()
{
	# Load HTML template
	my $html = &Common::load_html_template('todo');

	# Get CGI params
	my $date = $Common::cgi->param('day');
	my $week;
	my $dst = 0;

	my ($year, $month, $day);

	if ($date eq 'template') {
		# Load the template

		my $query = qq~
			SELECT id
			FROM todo_weeks
			WHERE start IS NULL AND end IS NULL
		~;
		$Common::db->prepare($query);
		my $sth = $Common::db->execute();

		$week = $sth->fetchrow_hashref();

		$Config::show_date = 0;
	} elsif ($date) {
		# Load the specified week with that day
		my $query = qq~
			SELECT id, start
			FROM todo_weeks
			WHERE start <= ? AND end >= ?
		~;
		$Common::db->prepare($query);
		my $sth = $Common::db->execute($date, $date);

		$week = $sth->fetchrow_hashref();

		unless ($week) {
			$week = &Common::create_week($date);
		}

		$year  = substr($week->{'start'}, 0, 4);
		$month = substr($week->{'start'}, 5, 2);
		$day   = substr($week->{'start'}, 8, 2);
		$week->{'time'} = mktime(0, 0, 0, $day, $month - 1, $year - 1900, 0, 0);
		my @parts = localtime($week->{'time'});
		if ($parts[8]) {
			$week->{'time'} -= 3600;
		}
	} else {
		# Figure out what the current week is
		my $query = qq~
			SELECT id, start
			FROM todo_weeks
			WHERE start <= CURDATE() AND end >= CURDATE()
		~;
		$Common::db->prepare($query);
		my $sth = $Common::db->execute();

		$week = $sth->fetchrow_hashref();

		unless ($week) {
			# Get the current day of the week
			my @parts = localtime(time());
			my $wday  = $parts[6];

			# Now get the first day of this week
			@parts    = localtime(time() - ($wday * 24 * 60 * 60));
			$year     = $parts[5] + 1900;
			$month    = &Common::fix_date($parts[4] + 1);
			$day      = &Common::fix_date($parts[3]);
			$dst      = $parts[8];
			$week     = &Common::create_week("$year$month$day");
		} else {
			# Get component parts of start date
			$year  = substr($week->{'start'}, 0, 4);
			$month = substr($week->{'start'}, 5, 2);
			$day   = substr($week->{'start'}, 8, 2);
		}
		$week->{'time'} = mktime(0, 0, 0, $day, $month - 1, $year - 1900);
		my @parts = localtime($week->{'time'});

		# When we're in DST, mktime() likes to give us the non-DST time
		if ($parts[8]) {
			$week->{'time'} -= 3600;
		}
	}

	# Find the start date of the previous week
	my $seven_days = 7 * 24 * 60 * 60;	# number of seconds in 7 days

	my @prev_week = localtime($week->{'time'} - $seven_days);

	my $prev_week = (1900 + $prev_week[5]) . &Common::fix_date($prev_week[4] + 1) . &Common::fix_date($prev_week[3]);
	my $prev_week_display = (1900 + $prev_week[5]) . '-' . &Common::fix_date($prev_week[4] + 1) . '-' . &Common::fix_date($prev_week[3]);

	# Find the start date of the next week
	my @next_week = localtime($week->{'time'} + $seven_days);

	my $next_week = (1900 + $next_week[5]) . &Common::fix_date($next_week[4] + 1) . &Common::fix_date($next_week[3]);
	my $next_week_display = (1900 + $next_week[5]) . '-' . &Common::fix_date($next_week[4] + 1) . '-' . &Common::fix_date($next_week[3]);

	if ($date ne 'template') {
		$html->param(week_start => $week->{'start'});
		$html->param(week_id    => $week->{'id'});
		$html->param(prev_week  => $prev_week);
		$html->param(next_week  => $next_week);
		$html->param(prev_week_display => $prev_week_display);
		$html->param(next_week_display => $next_week_display);

		if (time() >= $week->{'time'} && time() < ($week->{'time'} + $seven_days)) {
			$html->param(current_week => 1);
		}

		$html->param(start_year  => $year);
		$html->param(start_month => $month - 1);
		$html->param(start_day   => $day);
	} else {
		$html->param(week_id  => $week->{'id'});
		$html->param(template => 1);
	}

	$html->param(url          => $Config::url);
	$html->param(show_date    => $Config::show_date);
	$html->param(use_mark     => $Config::use_mark ? 1 : 0);
	$html->param(date_format  => $Config::date_format);
	$html->param(undated_last => $Config::undated_last);
	$html->param(index_url    => $Config::url);

	# Output
	&Common::output($html);
}

#######
## LOAD TEMPLATE
## Loads the template into the specified week
#######
sub load_template()
{
	# Get parameters
	my $week_id = $Common::cgi->param('week');

	my $week = &Common::load_template($week_id);

	# $week->{'start'} comes with hyphens that we don't want
	my @parts = split(/-/, $week->{'start'});
	$week->{'start'} = join('', @parts);

	# Now, output the list as usual
	print $Common::cgi->redirect($Config::url . $week->{'start'} . '/');
}

