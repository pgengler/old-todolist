function Item(values)
{
	var m_id         = values.id;
	var m_deleted    = values.deleted || 0;
	var m_date       = values.date || null;
	var m_day        = values.day || -1;
	var m_event      = values.event || '';
	var m_location   = values.location || null;
	var m_start      = values.start || -1;
	var m_end        = values.end || -1;
	var m_done       = values.done || 0;
	var m_marked     = values.marked || 0;
	var m_keep_until = values.keep_until || null;
	var m_tags       = values.tags || [ ];
	var m_timestamp  = values.timestamp || 0;

	var m_new        = false;
	var m_changed    = false;

	this.id = function()
	{
		return m_id;
	}

	this.deleted = function()
	{
		return m_deleted;
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

	this.timestamp = function(timestamp)
	{
		if (m_timestamp !== undefined)
			m_timestamp = timestamp;
		return m_timestamp ? m_timestamp : 0;
	}

	this.is_new = function()
	{
		return m_new;
	}

	this.set_new = function(is_new)
	{
		m_new = is_new;
	}

	this.is_changed = function()
	{
		return m_changed;
	}

	this.set_changed = function(changed)
	{
		m_changed = changed;
	}

	this.compareTo = function(b)
	{
		/* Sort order depends on the user's 'undated_last' preference
		 * If this pref is set to a true value, then undated items come after items with days;
		 * otherwise they appear before.
		 * Items with days are sorted by date (or normal week order (with a Sunday week start))
		 * For items on the same day:
		 *   - items without any times go first
		 *   - then items with only end times, sorted by end time (these items have an implicit '0000' start time)
		 *   - then items with start times, ordered by start item
		 *   - for items with the same start or end time, sort by name
		 */

		// First do days/dates
		if (this.day() == -1 && b.day() != -1)
			// 'this' is undated; 'b' has a date
			return undated_last ? 1 : -1;
		else if (this.day() != -1 && b.day() == -1)
			// 'this' has a date; 'b' is undated
			return undated_last ? -1 : 1;
		else if (this.day() != -1 && b.day() != -1) {
			// Neither item is undated; check dates
			if (this.date() && b.date()) {
				var result = this.date().compareTo(b.date());
				if (result != 0)
					return result;
			}
		}

		// Since we made it here, the items have the same day/date
		if (this.start() != b.start()) {
			return this.start() - b.start();
		}
		if (this.end() != b.end()) {
			return this.end() - b.end();
		}

		// Both items have the same times; sort by event name
		if (this.event() < b.event())
			return -1;
		else if (this.event() > b.event())
			return 1;

		// Same day/date, same times, same name -- say they're the same
		return 0;
	}
}

Item.from_xml = function(xml)
{
	var values = {
		id:         parseInt(xml.getAttribute('id')),
		deleted:    parseInt(xml.getAttribute('deleted')),
		date:       null,
		day:        null,
		event:      xml.getElementsByTagName('event')[0].firstChild.nodeValue,
		location:   xml.getElementsByTagName('location')[0].firstChild ? xml.getElementsByTagName('location')[0].firstChild.nodeValue : null,

		// Start & end times are not passed through parseInt because we want to preserve leading zeroes
		start:      xml.getElementsByTagName('start')[0].firstChild ? xml.getElementsByTagName('start')[0].firstChild.nodeValue : -1,
		end:        xml.getElementsByTagName('end')[0].firstChild ? xml.getElementsByTagName('end')[0].firstChild.nodeValue : -1,

		done:       parseInt(xml.getAttribute('done')),
		marked:     parseInt(xml.getAttribute('marked')),
		keep_until: null,
		timestamp:  parseInt(xml.getAttribute('timestamp')),

		tags:       [ ]
	};

	if (xml.getAttribute('date')) {
		var parts = xml.getAttribute('date').split('-');
		values.date = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59);
	}

	if (values.date == null)
		values.day = (xml.getAttribute('day') !== undefined) ? parseInt(xml.getAttribute('day')) : null;

	if (xml.getElementsByTagName('tag').length > 0) {
		var tags = xml.getElementsByTagName('tag');
		var len  = tags.length;

		for (var i = 0; i < len; i++)
			values.tags.push(parseInt(tags[i].getAttribute('id')));
	}

	if (xml.getElementsByTagName('keep_until').length > 0) {
	 var pieces = xml.getElementsByTagName('keep_until')[0].firstChild.nodeValue.split(' ');

		// pieces[0] is date (YYYY-MM-DD), pieces[1] is time (HH:MM:SS)
		var date_parts = pieces[0].split('-');
		var time_parts = pieces[1].split(':');

		values.keep_until = new Date(date_parts[0], date_parts[1] - 1, date_parts[2], time_parts[0], time_parts[1], time_parts[2]);
	}

	return new Item(values);
}

function Items()
{
	var m_items = [];

	this.add = function(item)
	{
		if (item.deleted())
			return;
		item.set_new(true);
		m_items.push(item);
	}

	this.update = function(item)
	{
		var len = m_items.length;

		for (var i = 0; i < len; i++) {
			if (m_items[i].id() == item.id()) {
				item.set_changed(true);
				m_items[i] = item;
				return;
			}
		}

		throw "Item with ID " + item.id() + " not in list!";
	}

	this.add_or_update = function(item)
	{
		if (this.get(item.id()) != null)
			this.update(item);
		else
			this.add(item);
	}

	/* This function clears all new/changed flags for the items and removed deleted items. */
	this.clear_flags = function()
	{
		var len = m_items.length;
		var items = [ ];
		for (var i = 0; i < len; i++) {
			var item = m_items[i];
			item.set_new(false);
			item.set_changed(false);
			if (!item.deleted())
				items.push(item);
		}
		m_items = items;
	}

	this.get_items = function()
	{
		m_items.sort(function(a, b) { return a.compareTo(b); });
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

Date.prototype.compareTo = function(date)
{
	if (this.getFullYear() < date.getFullYear())
		return -1;
	else if (this.getFullYear() > date.getFullYear())
		return 1;

	if (this.getMonth() < date.getMonth())
		return -1;
	else if (this.getMonth() > date.getMonth())
		return 1;

	if (this.getDate() < date.getDate())
		return -1;
	else if (this.getDate() > date.getDate())
		return 1;

	return 0;
}
