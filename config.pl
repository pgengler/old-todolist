package Config;

use strict;

# URL info
our $url          = 'http://personal.pgengler.net/todo/';

# Database connection info
our $db_host      = 'localhost';
our $db_user      = 'jsurrati_pgphil'; # username used to connect to the database
our $db_pass      = 'phil11!!';        # password used to connect to the database
our $db_name      = 'jsurrati_pgphil'; # name of the database to use (NOTE: DATABASE, not TABLES)
#our $db_name     = 'jsurrati_pgdev';
our $db_prefix    = '';

# Options
our $show_date    = 0;
our $use_mark     = 0;
our $undated_last = 0;
our $date_format  = " (%m/%d)";

1;
