package Common;

#######
## PERL SETUP
#######
use strict;

#######
## INCLUDES
#######
require 'config.pl';

use CGI qw/ header /;
use CGI::Carp 'fatalsToBrowser';
use Database;
use HTML::Template;
use JSON;
use POSIX;

#######
## GLOBALS
#######
our $cgi = new CGI;
our $db = new Database;
$db->init($Config::db_user, $Config::db_pass, $Config::db_name, 'localhost', \&error);

##############

#######
## LOAD HTML TEMPLATE
######
sub load_html_template()
{
	my $name = shift;

	my $html = new HTML::Template(
		filename          => 'templates/' . $name . '.tmpl',
		global_vars       => 1,
		loop_context_vars => 1
	);

	return $html;
}

#######
## ERROR
## Displays an error message to the user
#######
sub error()
{
	my ($message, $db_error) = @_;

	if ($db_error && !$Config::DEBUG) {
		$message = 'A database error has occurred.';
	}

	my $html = &load_html_template('error');

	$html->param(message => $message);

	&output($html);

	exit;
}

#######
## IS TEMPLATE LOADED?
## Checks if the template has been loaded for the specified day.
## If the given day is earlier than the current day, treat it as though it has the template loaded.
#######
sub template_loaded()
{
	my $date = shift;

	my $query = qq~
		SELECT COUNT(*) AS loaded, IF(? < DATE(NOW()), 1, 0) AS older
		FROM template_loaded
		WHERE `date` = ?
	~;
	$db->prepare($query);
	my $sth = $db->execute($date, $date);
	my $data = $sth->fetchrow_hashref();
	
	my $loaded = ($data->{'loaded'} || $data->{'older'});

	return $loaded;
}

#######
## LOAD TEMPLATE
## Loads the template for the specified date.
#######
sub load_template()
{
	# Get parameters
	my $date = shift;

	$db->start_transaction();

	# Get all template items for the day
	my $query = qq~
		SELECT id, event, location, start, end, mark
		FROM template_items
		WHERE day = DAYOFWEEK(?) AND COALESCE(deleted, 0) = 0
	~;
	$db->prepare($query);
	my $get_items = $db->execute($date);

	# Query for getting tags from a template item
	$query = qq~
		SELECT tag_id
		FROM template_item_tags
		WHERE item_id = ?
	~;
	my $get_tags = $db->prepare($query);

	# Query to insert items into 'todo' table
	$query = qq~
		INSERT INTO todo
		(`date`, event, location, start, end, mark, timestamp)
		VALUES
		(?, ?, ?, ?, ?, ?, UNIX_TIMESTAMP())
	~;
	my $insert = $db->prepare($query);

	# Query to add tags to new item
	$query = qq~
		INSERT INTO item_tags
		(item_id, tag_id)
		VALUES
		(?, ?)
	~;
	my $add_tags = $db->prepare($query);

	while (my $item = $get_items->fetchrow_hashref()) {
		$insert->execute($date, $item->{'event'}, $item->{'location'}, $item->{'start'}, $item->{'end'}, $item->{'mark'} || 0);
		my $new_id = $insert->{'mysql_insertid'};

		# Get tags for this template item
		$get_tags->execute($item->{'id'});
		while (my $tag = $get_tags->fetchrow_hashref()) {
			$add_tags->execute($new_id, $tag->{'tag_id'});
		}
	}

	# Mark the template as loaded for this day
	$query = qq~
		INSERT INTO template_loaded
		(`date`)
		VALUES
		(?)
	~;
	$db->prepare($query);
	$db->execute($date);

	$db->commit_transaction();
}

#######
## TRIM SPACES
#######
sub trim()
{
	my $str = shift;
	return undef unless $str;

	$str =~ s/^\s*(.+)\s*$/$1/;

	return $str;
}

#######
## OUTPUT
#######
sub output()
{
	my ($tmpl) = @_;

	print $cgi->header( -charset => 'UTF-8' );
	if ($tmpl) {
		print $tmpl->output();
	}
}

#######
## JSON OUTPUT
#######
sub output_json($)
{
	my ($output_vars) = @_;

	print header({ 'type' => 'application/json', 'charset' => 'UTF-8' });
	print JSON::to_json($output_vars);
}

1;
