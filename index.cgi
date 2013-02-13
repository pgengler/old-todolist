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
	$html->param(template     => 1) if ($date eq 'template');

	# Output
	&Common::output($html);
}
