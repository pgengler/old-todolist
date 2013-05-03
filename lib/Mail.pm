package Mail;

use strict;

use Encode;
use MIME::Entity;
use Net::SMTP;
use POSIX;

sub new()
{
	my $class = shift;
	my $self = {
		'_subject' => undef,
		'_from'    => undef,
		'_to'      => undef,
		'_cc'      => undef,
		'_bcc'     => undef,
		'_replyto' => undef,
		'_message' => undef,
		'_format'  => 'plain',
	};
	bless $self, $class;
	return $self;
}

#######
## SUBJECT
#######
sub subject()
{
	my ($self, $subject) = @_;
	$self->{'_subject'} = $subject if defined($subject);
	return $self->{'_subject'};
}

#######
## FROM
#######
sub from()
{
	my ($self, $from) = @_;
	$self->{'_from'} = $from if defined($from);
	return $self->{'_from'};
}

#######
## TO
#######
sub to()
{
	my ($self, @to) = @_;
	if (@to) {
		$self->{'_to'} = \@to;
	}
	return $self->{'_to'};
}

#######
## CC
#######
sub cc()
{
	my ($self, @cc) = @_;

	if (@cc) {
		$self->{'_cc'} = \@cc;
	}

	return $self->{'_cc'};
}

#######
## BCC
#######
sub bcc()
{
	my ($self, @bcc) = @_;

	if (@bcc) {
		$self->{'_bcc'} = \@bcc;
	}

	return $self->{'_bcc'};
}

#######
## REPLY-TO
#######
sub replyto()
{
	my ($self, $replyto) = @_;
	$self->{'_replyto'} = $replyto if defined($replyto);
	return $self->{'_replyto'};
}

#######
## MESSAGE
#######
sub message()
{
	my ($self, $message) = @_;
	$self->{'_message'} = $message if defined($message);
	return $self->{'_message'};
}

#######
## FORMAT
#######
sub format()
{
	my ($self, $format) = @_;
	if (defined($format)) {
		$self->{'_format'} = $format if ($format eq 'plain' || $format eq 'html');
	}
	return $self->{'_format'};
}

#######
## SEND
#######
sub send()
{
	my $self = shift;

	my $entity = MIME::Entity->build(
		Type       => 'text/' . $self->{'_format'},
		Charset    => 'UTF-8',
		Encoding   => 'quoted-printable',
		Data       => Encode::encode('UTF-8', $self->{'_message'}),
		Date       => strftime('%a, %d %b %Y %H:%M:%S %z', localtime(time())),
		From       => Encode::encode('MIME-Header', $self->{'_from'}),
		'Reply-To' => $self->{'_replyto'} ? Encode::encode('MIME-Header', $self->{'_replyto'}) : undef,
		To         => $self->{'_to'} ? Encode::encode('MIME-Header', join(', ', @{$self->{'_to'}})) : undef,
		CC         => $self->{'_cc'} ? Encode::encode('MIME-Header', join(', ', @{$self->{'_cc'}})) : undef,
		Subject    => Encode::encode('MIME-Header', $self->{'_subject'})
	);

	my $smtp = new Net::SMTP('localhost');

	$smtp->mail($self->{'_from'});
	$smtp->to(@{$self->{'_to'}}, @{$self->{'_cc'}}, @{$self->{'_bcc'}});

	$smtp->data();
	my $msg = $entity->stringify;
	while ($msg =~ /([^\r\n]*)(\r\n|\n\r|\r|\n)?/g) {
		my $line = (defined($1) ? $1 : '') . "\r\n";
		$smtp->datasend($line);
	}
	$smtp->dataend();

	$smtp->quit();
}

1;
