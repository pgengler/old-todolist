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
	'template' => \&edit_template
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

	$html->param(url          => $Config::url);
	$html->param(show_date    => $Config::show_date);
	$html->param(use_mark     => $Config::use_mark ? 1 : 0);
	$html->param(date_format  => $Config::date_format);
	$html->param(index_url    => $Config::url);
	$html->param(images_url   => $Config::url . '/images');
	$html->param(undated_last => $Config::undated_last);
	$html->param(rolling      => $Config::use_rolling);
	$html->param(template     => 1) if ($date eq 'template');

	if (!$Config::use_rolling && (!$date || $date ne 'template')) {
		my $view;
		if ($date && $date =~ /^(\d{4})-(\d{2})-(\d{2})$/) {
			my ($year, $month, $day) = split(/-/, $date);
			$view = mktime(0, 0, 0, $day, $month - 1, $year - 1900);
		} else {
			$html->param(current_week => 1);
			$view = time();
		}
		my @parts = localtime($view);

		# Get the UNIX-style date for Sunday of this week
		my $start = $view - ($parts[6] * 24 * 60 * 60);

		$html->param(prev_week => strftime('%Y-%m-%d', localtime($start - (7 * 24 * 60 * 60))));
		$html->param(next_week => strftime('%Y-%m-%d', localtime($start + (7 * 24 * 60 * 60))));
	}

	# Output
	&Common::output($html);
}
