#!/usr/bin/perl

use strict;

use Common;

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
