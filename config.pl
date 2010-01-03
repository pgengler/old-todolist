package Config;

use strict;

# URL info
our $url          = 'http://personal.pgengler.net/todo/';

# Database connection info
our $db_host      = 'localhost';
our $db_user      = 'jsurrati_pgptodo'; # username used to connect to the database
our $db_pass      = 'todo11!!';         # password used to connect to the database
our $db_name      = 'jsurrati_pgptodo'; # name of the database to use (NOTE: DATABASE, not TABLES)
#our $db_name     = 'jsurrati_pgptododev';
our $db_prefix    = '';

#######
## Options
#######

# Show date next to day name for all items
our $show_date    = 0;

# Use "mark" feature
our $use_mark     = 0;

# When set to 0, shows undated items at the top of the list. Otherwise at the bottom.
our $undated_last = 0;

# Format for showing dates (for $show_date, above, and day dropdown box)
our $date_format  = "%a (%m/%d)";

# Use rolling seven-day view?
our $use_rolling  = 1;

1;
