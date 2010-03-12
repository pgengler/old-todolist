#!/usr/bin/perl

#######
## This script adds the necessary database fields used for incremental updates of the list (Todo #1695)

use strict;

require 'config.pl';
use Database;

###############

my $db = new Database();
$db->init($Config::db_user, $Config::db_pass, $Config::db_name);

print "Adding new columns...\n";

$db->start_transaction();

# Add new columns to `template_items` table
my $sql = qq~
	ALTER TABLE template_items
	ADD COLUMN `deleted` TINYINT(1) NULL,
	ADD COLUMN `timestamp` INT NOT NULL
~;
$db->prepare($sql);
$db->execute();

# Add new columns to `todo` table
$sql =~ s/template_items/todo/;
$db->prepare($sql);
$db->execute();

$db->commit_transaction();

print "Done!\n";
