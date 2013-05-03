package Template::Text;

use strict;

use parent 'Template::Core';

sub new()
{
	my $class = shift;
	my ($name, $template_dir) = @_;
	$template_dir ||= 'templates';

	$name .= '.txt.tt2';

	my $self = $class->SUPER::new($name, $template_dir, @_[2..$#_]);

	return bless $self, $class;
}

1;
