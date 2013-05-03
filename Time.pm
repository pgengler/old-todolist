package Time;

use strict;
use warnings;
use feature 'say';

use Accessor;

accessor qw/ hour minute second /;

use overload '""' => 'to_s';

sub new
{
	my $class = shift;
	my ($string) = @_;

	my ($hour, $minute, $second) = _parse_time($string);

	my $self = {
		'_vars' => {
			'hour'   => $hour,
			'minute' => $minute,
			'second' => $second,
		}
	};

	bless $self, $class;
}

sub to_s
{
	my $self = shift;

	return sprintf('%02d:%02d:%02d', $self->hour, $self->minute, $self->second);
}

sub _parse_time($)
{
	my ($string) = @_;

	my ($hour, $minute, $second) = map { int } split(/:/, $string);

	return ($hour, $minute, $second);
}

sub now
{
	my ($second, $minute, $hour) = localtime;

	return sprintf('%02d:%02d:%02d', $hour, $minute, $second);
}

1;
