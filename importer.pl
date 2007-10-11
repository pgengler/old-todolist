#!/usr/bin/perl

#######
## PERL OPTIONS
######
use strict;

#######
## INCLUDES
#######
use Database;
use POSIX;
use XML::Simple;

require 'config.pl';

#######
## GLOBALS
#######
my $db   = new Database;
my $xml  = new XML::Simple;

my $path = '/home/jsurrati/www/pgengler/personal/todo/';

#######
## GLOBAL INITIALIZATION
#######
$db->init($Config::db_user, $Config::db_pass, $Config::db_name);
$db->start_transaction();

#######
## MAIN CODE
#######

opendir(DIR, $path);
my @files = readdir(DIR);
closedir(DIR);

foreach my $file (@files) {
	next unless ($file =~ /xml$/);
	next if (-d $path . $file);
	next if ($file eq 'todo.xml' || $file eq 'modelrr.xml' || $file eq 'template.xml');

	print "Processing $file...\n";

	my $doc = $xml->xml_in($path . $file, ForceArray => [ 'event' ]);

	my $week_start = $doc->{'week'};

	# Look up week
	my $query = qq~
		SELECT id, start
		FROM todo_weeks
		WHERE start = ?
	~;
	$db->prepare($query);
	my $sth = $db->execute($week_start);

	my $week = $sth->fetchrow_hashref();

	unless ($week && $week->{'start'}) {
		# Add week
		my $week_start_year  = substr($week_start, 0, 4);
		my $week_start_month = substr($week_start, 5, 2);
		my $week_start_day   = substr($week_start, 8, 2);

		my $week_start_unix = mktime(0, 0, 0, $week_start_day, $week_start_month - 1, $week_start_year - 1900, 0, 0);

		my $week_end_unix = $week_start_unix + (6 * 24 * 60 * 60);
		my @week_end = localtime($week_end_unix);

		my $week_end_year  = $week_end[5] + 1900;
		my $week_end_month = $week_end[4] + 1;
		my $week_end_day   = $week_end[3];

		my $week_end = $week_end_year . '-' . &fix_date($week_end_month) . '-' . &fix_date($week_end_day);

		$query = qq~
			INSERT INTO todo_weeks
			(start, end)
			VALUES
			(?, ?)
		~;
		$db->prepare($query);
		$db->execute($week_start, $week_end);

		my $new_id = $db->insert_id();

		# Get new week
		$query = qq~
			SELECT id, start
			FROM todo_weeks
			WHERE id = ?
		~;
		$db->prepare($query);
		$sth = $db->execute($new_id);

		$week = $sth->fetchrow_hashref();
	}

	my @days = ( '--', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' );

	$query = qq~
		INSERT INTO todo
		(day, event, location, start, end, done, week)
		VALUES
		(?, ?, ?, ?, ?, ?, ?)
	~;
	$db->prepare($query);

	foreach my $event (@{ $doc->{'event'} }) {
		my $day = $event->{'day'} || -1;
		my $eventtext = &trim_string($event->{'content'});
		my $location = $event->{'location'};
		my $start = $event->{'start'};
		my $end = $event->{'end'};
		my $done = $event->{'done'} eq 'yes' ? 1 : 0;

		$db->execute($day, $eventtext, $location, $start, $end, $done, $week->{'id'});
	}

}

$db->commit_transaction();

#######
## SUBROUTINES
#######
sub fix_date()
{
	my $date = shift;

	return $date if ($date >= 10 || length($date) == 2);

	return '0' . $date;
}

sub trim_string()
{
	my $string = shift;

	$string =~ s/^\s+//;
	$string =~ s/\s+$//;

	return $string;
}
