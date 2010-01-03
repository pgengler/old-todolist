#!/usr/bin/perl

use strict;

require 'config.pl';
use Database;

###############

my $db = new Database();
$db->init($Config::db_user, $Config::db_pass, $Config::db_name);

$db->start_transaction();

# Create new tables for template

## Create 'template_loaded' table
my $query = qq~
	CREATE TABLE IF NOT EXISTS `${Config::db_prefix}template_loaded` (
		`id` int(10) unsigned NOT NULL auto_increment,
		`date` date NOT NULL,
		PRIMARY KEY  (`id`),
		UNIQUE KEY `date` (`date`)
	) ENGINE=InnoDB  DEFAULT CHARSET=utf8
~;
$db->prepare($query);
$db->execute();

## Create 'template_items' table
$query = qq~
	CREATE TABLE IF NOT EXISTS `${Config::db_prefix}template_items` (
		`id` smallint(5) unsigned NOT NULL auto_increment,
		`day` enum('0','1','2','3','4','5','6') default NULL,
		`event` varchar(128) NOT NULL,
		`location` varchar(128) default NULL,
		`start` char(4) default NULL,
		`end` char(4) default NULL,
		`mark` tinyint(1) default NULL,
		PRIMARY KEY  (`id`)
	) ENGINE=InnoDB  DEFAULT CHARSET=utf8
~;
$db->prepare($query);
$db->execute();

## Create 'template_item_tags' table
$query = qq~
	CREATE TABLE IF NOT EXISTS `${Config::db_prefix}template_item_tags` (
		`item_id` smallint(5) unsigned NOT NULL,
		`tag_id` int(10) unsigned NOT NULL
	) ENGINE=InnoDB DEFAULT CHARSET=utf8
~;
$db->prepare($query);
$db->execute();

# Populate template tables

## Find template week
$query = qq~
	SELECT id
	FROM todo_weeks
	WHERE start IS NULL AND end IS NULL
~;
$db->prepare($query);
my $sth = $db->execute();
my $template_week_id = $sth->fetchrow_hashref()->{'id'};

## Find all items in that week
$query = qq~
	SELECT *
	FROM ${Config::db_prefix}todo
	WHERE week = ?
~;
$db->prepare($query);
$sth = $db->execute($template_week_id);

## Add template items to 'template_items' table
$query = qq~
	INSERT INTO ${Config::db_prefix}template_items
	(day, event, location, start, end, mark)
	VALUES
	(?, ?, ?, ?, ?, ?)
~;
my $insert = $db->prepare($query);

## Get item tags
$query = qq~
	SELECT tag_id
	FROM ${Config::db_prefix}item_tags
	WHERE item_id = ?
~;
my $get_tags = $db->prepare($query);

## Add template item tag
$query = qq~
	INSERT INTO ${Config::db_prefix}template_item_tags
	(item_id, tag_id)
	VALUES
	(?, ?)
~;
my $add_tag = $db->prepare($query);

while (my $item = $sth->fetchrow_hashref()) {
	$insert->execute($item->{'day'}, $item->{'event'}, $item->{'location'}, $item->{'start'}, $item->{'end'}, $item->{'mark'});

	my $item_id = $insert->{'mysql_insertid'};

	$get_tags->execute($item->{'id'});

	while (my $tag = $get_tags->fetchrow_hashref()) {
		$add_tag->execute($item_id, $tag->{'tag_id'});
	}
}

# Remove template items from main items table

## First remove item_tags for them
$query = qq~
	DELETE FROM ${Config::db_prefix}item_tags
	WHERE item_id IN ( SELECT id FROM ${Config::db_prefix}todo WHERE week = ? )
~;
$db->prepare($query);
$db->execute($template_week_id);

## Now remove from the 'todo' table
$query = qq~
	DELETE FROM ${Config::db_prefix}todo
	WHERE week = ?
~;
$db->prepare($query);
$db->execute($template_week_id);

# Add `date` column to 'todo' table
$query = qq~
	ALTER TABLE `${Config::db_prefix}todo` ADD `date` DATE NULL AFTER `day`
~;
$db->prepare($query);
$db->execute();

# Add `keep_until` column to 'todo' table
$query = qq~
	ALTER TABLE `${Config::db_prefix}todo` ADD `keep_until` DATETIME NULL
~;
$db->prepare($query);
$db->execute();

# Set `date` field for items
$query = qq~
	UPDATE ${Config::db_prefix}todo t, ${Config::db_prefix}todo_weeks w SET
		t.date = DATE_ADD(w.start, INTERVAL (t.day - 1) DAY)
	WHERE t.day IS NOT NULL AND t.day != '' AND t.week = w.id AND w.start IS NOT NULL
~;
$db->prepare($query);
$db->execute();

# Drop `day` column in 'todo' table
$query = qq~
	ALTER TABLE `${Config::db_prefix}todo` DROP `day`
~;
$db->prepare($query);
$db->execute();

# Drop `week` column in 'todo' table
$query = qq~
	ALTER TABLE `${Config::db_prefix}todo` DROP `week`
~;
$db->prepare($query);
$db->execute();

# Drop 'todo_weeks' table
$query = qq~
	DROP TABLE `${Config::db_prefix}todo_weeks`
~;
$db->prepare($query);
$db->execute();

$db->commit_transaction();
