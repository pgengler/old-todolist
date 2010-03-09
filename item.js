function Item(xml)
{
	var m_id         = parseInt(xml.getAttribute('id'));

	var m_date       = null;
	if (xml.getAttribute('date')) {
		var parts = xml.getAttribute('date').split('-');
		m_date = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59);
	}

	var m_day        = null;
	if (m_date == null)
		m_day = (xml.getAttribute('day') !== undefined) ? parseInt(xml.getAttribute('day')) : null;

	var m_event      = xml.getElementsByTagName('event')[0].firstChild.nodeValue;
	var m_location   = xml.getElementsByTagName('location')[0].firstChild ? xml.getElementsByTagName('location')[0].firstChild.nodeValue : null;

	// Start & end times are not passed through parseInt because we want to preserve leading zeroes
	var m_start      = xml.getElementsByTagName('start')[0].firstChild ? xml.getElementsByTagName('start')[0].firstChild.nodeValue : -1;
	var m_end        = xml.getElementsByTagName('end')[0].firstChild ? xml.getElementsByTagName('end')[0].firstChild.nodeValue : -1;

	var m_done       = parseInt(xml.getAttribute('done'));
	var m_marked     = parseInt(xml.getAttribute('marked'));

	// Load item tags
	var m_tags = [ ];

	if (xml.getElementsByTagName('tag').length > 0) {
		var list = xml.getElementsByTagName('tag');
		var len  = list.length;

		for (var i = 0; i < len; i++)
			m_tags.push(parseInt(list[i].getAttribute('id')));
	}

	var m_keep_until = null;
	if (xml.getElementsByTagName('keep_until').length > 0) {
	 var pieces = xml.getElementsByTagName('keep_until')[0].firstChild.nodeValue.split(' ');

		// pieces[0] is date (YYYY-MM-DD), pieces[1] is time (HH:MM:SS)
		var date_parts = pieces[0].split('-');
		var time_parts = pieces[1].split(':');

		m_keep_until = new Date(date_parts[0], date_parts[1] - 1, date_parts[2], time_parts[0], time_parts[1], time_parts[2]);
	}

	this.id = function()
	{
		return m_id;
	}
	this.day = function()
	{
		if (m_date)
			return m_date.getDay();
		return m_day;
	}
	this.date = function()
	{
		return m_date;
	}
	this.event = function()
	{
		return m_event;
	}
	this.location = function()
	{
		return m_location;
	}
	this.start = function()
	{
		return m_start;
	}
	this.end = function()
	{
		return m_end;
	}
	this.done = function()
	{
		return m_done;
	}
	this.marked = function()
	{
		return m_marked;
	}
	this.tags = function()
	{
		return m_tags || [ ];
	}
	this.keep_until = function()
	{
		return m_keep_until;
	}

	this.set_date = function(date)
	{
		m_date = date;
	}

	this.set_event = function(event)
	{
		m_event = event;
	}

	this.set_location = function(location)
	{
		m_location = location;
	}

	this.set_start = function(start)
	{
		m_start = start;
	}

	this.set_end = function(end)
	{
		m_end = end;
	}

	this.set_times = function(start, end)
	{
		this.set_start(start);
		this.set_end(end);
	}

	this.set_done = function(done)
	{
		m_done = done;
	}
	this.toggle_done = function()
	{
		m_done = !m_done;
	}

	this.set_marked = function(marked)
	{
		m_marked = marked;
	}
	this.toggle_marked = function()
	{
		m_marked = !m_marked;
	}

	this.set_tags = function(tags)
	{
		m_tags = tags;
	}
	this.add_tag = function(tag)
	{
		m_tags.push(tag);
	}
}


function Items()
{
	var m_items = [];

	this.add = function(item)
	{
		if (m_items.length == 0) {
			m_items.push(item);
			return;
		}

		// Items without a date go in front of this with; otherwise, normal week order applies (Sunday-Saturday)
		// Items without a start or end time go ahead of those with either, followed by items with only end times
		// (sorted by end time). These are followed by items with start times, ordered by start time.

		var at = -1;
		for (var i = 0; i < m_items.length; i++) {
			var c = m_items[i];

			var item_val = null;
			var c_val    = null;
			if (template || !rolling) {
				item_val = item.day();
				c_val    = c.day();

				item_val = (item_val == -1 && undated_last) ? 7 : item_val;
				c_val    = (c_val == -1 && undated_last) ? 7 : c_val;
			} else {
				item_val = item.date();
				c_val    = c.date()

				item_val = (item_val == null && undated_last) ? new Date(9999, 12, 31) : item_val;
				c_val    = (c_val == null && undated_last) ? new Date(9999, 12, 31) : c_val;
			}

			if (item_val < c_val) {
				at = i;
				break;
			} else if (item_val == c_val) {
				// Same day, check for differing times and sort appropriately
				if (item.start() == -1 && item.end() == -1) {
					if ((item.event().toUpperCase() < c.event().toUpperCase()) || (c.start() != -1 || c.end() != -1)) {
						at = i;
						break;
					}
				} else if (item.start() == -1 && item.end() != -1) {
					if (c.start() != -1) {
						at = i;
						break;
					} else if (item.end() < c.end()) {
						at = i;
						break;
					} else if (item.end() == c.end()) {
						if (item.event().toUpperCase() < c.event().toUpperCase()) {
							at = i;
							break;
						}
					}
				} else if (item.start() != -1 && item.end() == -1) {
					if (item.start() < c.start()) {
						at = i;
						break;
					} else if (item.start() == c.start()) {
						if (item.event().toUpperCase() < c.event().toUpperCase()) {
							at = i;
							break;
						}
					}
				} else if (item.start() < c.start()) {
					at = i;
					break;
				} else if (item.start() == c.start()) {
					if (item.event().toUpperCase() < c.event().toUpperCase()) {
						at = i;
						break;
					}
				}
			}
		}

		// Now insert into the array
		if (at == -1)
			m_items.push(item);
		else if (at == 0)
			m_items.unshift(item)
		else {
			var front = m_items.slice(0, at);
			front.push(item);
			var rear = m_items.slice(at);
			for (var i = 0; i < rear.length; i++)
				front.push(rear[i]);
			m_items = front;
		}
	}

	this.get_items = function()
	{
		return m_items;
	}

	this.get = function(id)
	{
		var len = m_items.length;
		for (var i = 0; i < len; i++) {
			if (m_items[i].id() == id)
				return m_items[i];
		}
		return null;
	}
}
