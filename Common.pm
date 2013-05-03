package Common;

#######
## PERL SETUP
#######
use strict;

#######
## INCLUDES
#######
use lib qw/ lib /;
require 'config.pl';

use CGI qw/ header /;
use CGI::Carp 'fatalsToBrowser';
use Cwd;
use Database::Postgres;
use HTML::Template;
use JSON;
use POSIX;

use Template::HTML;

#######
## GLOBALS
#######
our $cgi = new CGI;
our $db = Database::Postgres->new(
	'database' => $Config::db_name,
	'username' => $Config::db_user,
	'password' => $Config::db_pass,
	'error'    => \&error,
);

##############

#######
## LOAD HTML TEMPLATE
######
sub load_html_template($)
{
	my ($name) = @_;

	return Template::HTML->new($name, Cwd::getcwd() . '/templates');
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

	output_html('error', {
		'message' => $message,
	});

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
	my $data = $db->statement($query)->execute($date, $date)->fetch;

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
	my $get_items = $db->statement($query)->execute($date);

	# Query for getting tags from a template item
	$query = qq~
		SELECT tag_id
		FROM template_item_tags
		WHERE item_id = ?
	~;
	my $get_tags = $db->statement($query);

	# Query to insert items into 'todo' table
	$query = qq~
		INSERT INTO todo
		(`date`, event, location, start, end, mark, timestamp)
		VALUES
		(?, ?, ?, ?, ?, ?, UNIX_TIMESTAMP())
		RETURNING id
	~;
	my $insert = $db->statement($query);

	# Query to add tags to new item
	$query = qq~
		INSERT INTO item_tags
		(item_id, tag_id)
		VALUES
		(?, ?)
	~;
	my $add_tags = $db->statement($query);

	while (my $item = $get_items->fetch) {
		my $new_id = $insert->execute($date, $item->{'event'}, $item->{'location'}, $item->{'start'}, $item->{'end'}, $item->{'mark'} || 0)->fetch('id');

		# Get tags for this template item
		$get_tags->execute($item->{'id'});
		while (my $tag = $get_tags->fetch) {
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
	$db->statement($query)->execute($date);

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
## HTML OUTPUT
#######
sub output_html($;$)
{
	my ($template_name, $output_vars) = @_;

	print header({ 'charset' => 'UTF-8' });

	my $template = load_html_template($template_name);
	print $template->process($output_vars);
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
