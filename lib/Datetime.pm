package Datetime;

use strict;
use warnings;

use Accessor;
use Date;
use Time;

accessor 'date', 'time';

use overload '""' => 'to_s';
use overload '+'  => 'add';

sub new
{
	my $class = shift;
	my ($string) = @_;

	my ($date_part, $time_part) = split(/ /, $string);

	my $self = {
		'_vars' => {
			'date' => Date->new($date_part),
			'time' => Time->new($time_part),
		},
	};

	bless $self, $class;
}

sub to_s
{
	my $self = shift;

	return sprintf('%s %s', $self->date, $self->time);
}

sub add
{
	my $self = shift;
	my ($days) = @_;

	my $date = $self->date + $days;

	return Datetime->new($date . ' ' . $self->time);
}

sub now
{
	my $date = Date->now;
	my $time = Time->now;

	return Datetime->new("${date} ${time}");
}

1;
