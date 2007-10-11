package Database;

use strict;
use DBI;
use CGI::Carp "fatalsToBrowser";

sub new
{
	my $pkg = shift;
	my $obj = { 
		'queries'		=> 0,
		'database'	=> '',
		'user'			=> '',
		'password'	=> '',
		'host'			=> '',
		'dbh'				=> undef
	};
	bless $obj, $pkg;
	return $obj;
}

sub init
{
	my $this = shift;
	my ($user, $password, $database, $host) = @_;
	$host = 'localhost' unless $host;
	$this->{'dbh'} = DBI->connect("DBI:mysql:$database:$host:3306", $user, $password) or die DBI::errstr;
}

sub close
{
	my $this = shift;
	$this->{'dbh'}->disconnect();
}

sub query
{
	my ($this, $query) = @_;
	my $sth = $this->{'dbh'}->prepare($query);
	$this->{'query'} = $query;
	$sth->execute() or die "Couldn't execute statement: " . $sth->errstr . " in query " . $query;
	$this->{'queries'}++;
	return $sth;
}

sub prepare
{
	my ($this, $query) = @_;
	$this->{'sth'} = $this->{'dbh'}->prepare($query);
	$this->{'query'} = $query;
	return $this->{'sth'};
}

sub execute
{
	my ($this, @params) = @_;
	return unless $this->{'sth'};
	$this->{'sth'}->execute(@params) or die "Couldn't execute statement: " . $this->{'sth'}->errstr . " in query " . $this->{'query'};
	return $this->{'sth'};
}

sub start_transaction()
{
	my $this = shift;

	# Abort if we're already in a transaction
	if ($this->{'transaction'}) {
		return;
	}

	my $sth = $this->{'dbh'}->prepare('BEGIN');
	$sth->execute();
	$this->{'transaction'} = 1;
}

sub commit_transaction()
{
	my $this = shift;

	# Abort if we're not in a transaction
	unless ($this->{'transaction'}) {
		return;
	}

	my $sth = $this->{'dbh'}->prepare('COMMIT');
	$sth->execute();
	$this->{'transaction'} = 0;
}

sub rollback_transaction()
{
	my $this = shift;

	# Abort if we're not in a transaction
	unless ($this->{'transaction'}) {
		return;
	}

	$this->{'dbh'}->prepare('ROLLBACK');
	$this->{'dbh'}->execute();
	$this->{'transaction'} = 0;
}	
sub num_queries
{
	my $this = shift;
	return $this->{'queries'};
}

sub insert_id
{
	my $this = shift;
	return $this->{'dbh'}->{'mysql_insertid'};
}

sub filter
{
	my ($this, $text) = @_;
	$text =~ s/\\/\\\\/ig;
	$text =~ s/\'/\\\'/ig;
	return $text;
}

1;
