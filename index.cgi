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
	# Get CGI params
	my $date = $Common::cgi->param('day');

	my $output_vars = {
		'date_format'  => $Config::date_format,
		'images_url'   => "${Config::url}/images",
		'index_url'    => $Config::url,
		'show_date'    => $Config::show_date,
		'undated_last' => $Config::undated_last,
		'url'          => $Config::url,
		'use_mark'     => $Config::use_mark,
	};

	if ($date eq 'template') {
		$output_vars->{'template'} = 1;
	}

	# Output
	Common::output_html('index', $output_vars);
}
