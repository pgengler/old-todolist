package Accessor;

use strict;
use warnings;

use parent 'Exporter';
our @EXPORT = qw/ accessor /;

sub accessor(@)
{
	my (@names) = @_;

	my $class = _caller_package();

	foreach my $name (@names) {
		add_accessor($class, $name);
	}
}

sub add_accessor($$)
{
	my ($class, $name) = @_;

	{
		no strict 'refs';
		*{"${class}::${name}"} = sub {
			my $self = shift;

			$self->{'_vars'}->{ $name };
		};
	}
}

sub _caller_package()
{
	my @caller = caller(1);

	return $caller[0];
}

1;
