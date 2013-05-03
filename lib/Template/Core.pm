package Template::Core;

use strict;

use Template;

sub new()
{
	my $class = shift;
	my ($name, $template_dir, $extra) = @_;
	$template_dir ||= 'templates';

	my $self = {
		'ABSOLUTE'      => 1,
		'INCLUDE_PATH'  => $template_dir,

		'_filename'     => $name,
		'_template_dir' => $template_dir,

		'VARIABLES'     => $extra,
	};

	return bless $self, $class;
}

sub process()
{
	my $self = shift;
	my ($vars) = @_;

	if (not defined $self->{'_template'}) {
		$self->{'_template'} = new Template({ %$self });
	}

	my $name_with_path = sprintf('%s/%s', $self->{'_template_dir'}, $self->{'_filename'});

	my $output = '';
	$self->{'_template'}->process($name_with_path, $vars, \$output) or die $self->{'_template'}->error();

	return $output;
}

1;
