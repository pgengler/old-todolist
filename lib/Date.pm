package Date;

use strict;
use warnings;

use POSIX qw/ mktime strftime /;

use overload '<=>' => 'compare_to';
use overload '""'  => 'to_s';
use overload '+'   => 'add';

sub new
{
	my $class = shift;
	my ($string) = @_;

	my ($year, $month, $day) = _parse_date($string);

	my $self = {
		'_vars' => {
			'day'   => $day,
			'month' => $month,
			'year'  => $year,
		},
	};

	bless $self, $class;
}

sub compare_to
{
	my $self = shift;
	my ($other) = @_;

	if ($self->year != $other->year) {
		return $self->year <=> $other->year;
	}

	if ($self->month != $other->month) {
		return $self->month <=> $other->month;
	}

	if ($self->day != $other->day) {
		return $self->day <=> $other->day;
	}

	return 0;
}

sub to_s
{
	my $self = shift;

	return sprintf('%04d-%02d-%02d', $self->year, $self->month, $self->day);
}

sub add
{
	my $self = shift;
	my ($days) = @_;

	my $str = sprintf('%04d-%02d-%02d', $self->year, $self->month, $self->day + $days);
	Date->new($str);
}

sub day_of_week
{
	my $self = shift;

	strftime('%w', 0, 0, 12, $self->day, $self->month - 1, $self->year - 1900);
}

sub _parse_date($)
{
	my ($string) = @_;

	my ($year, $month, $day) = split(/-/, $string);
	my ($second, $minute, $hour);

	my $timestamp = mktime(0, 0, 12, $day, $month - 1, $year - 1900);
	($second, $minute, $hour, $day, $month, $year) = localtime($timestamp);
	$year += 1900;
	$month += 1;

	return ($year, $month, $day);
}

sub AUTOLOAD
{
	my $self = shift;

	return unless ref($self);

	(my $name = our $AUTOLOAD) =~ s/.*:://;

	return if $name =~ /^DESTROY$/;

	if (exists $self->{'_vars'}->{ $name }) {
		# Generate accessor
		my $accessor = sub {
			my $self = shift;
			return $self->{'_vars'}->{ $name };
		};
		{
			no strict 'refs';
			*{__PACKAGE__ . "::${name}"} = $accessor;
		}
		# Return value
		return $accessor->($self);
	} else {
		die "Unknown method '${name}'";
	}
}

sub now
{
	my $str = strftime('%Y-%m-%d', localtime);

	Date->new($str);
}

1;
