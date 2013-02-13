package Config;

use strict;

# URL info
our $url          = 'http://todolist.pgengler.net/';

# Database connection info
our $db_host      = 'localhost';
our $db_user      = 'todolist'; # username used to connect to the database
our $db_pass      = 'todo11!!'; # password used to connect to the database
our $db_name      = 'todolist'; # name of the database to use (NOTE: DATABASE, not TABLES)
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

1;
