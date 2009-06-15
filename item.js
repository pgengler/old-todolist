function Item(id, day, date, event, location, start, end, done, marked, tags)
{
	var m_id       = id;
	var m_day      = day;
	var m_date     = date;
	var m_event    = event;
	var m_location = location;
	var m_start    = start || -1;
	var m_end      = end || -1;
	var m_done     = done;
	var m_marked   = marked;
	var m_tags     = tags || [];

	this.id = function()
	{
		return m_id;
	}
	this.day = function()
	{
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
		return m_tags;
	}

	this.set_day = function(day)
	{
		if (day >= -1 && day < 7)
			m_day = day;
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

			if (item.day() < c.day()) {
				at = i;
				break;
			} else if (item.day() == c.day()) {
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
