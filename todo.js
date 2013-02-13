var items        = new Items();
var tags         = new Tags();
var used_tags    = new Hash();
var show_tags    = new Hash();
var extra_states = new Hash();
var menu_stack   = [];

var options_box   = null;
var tag_sel_box   = null;
var color_key_box = null;

var pick_tags_popup = null;
var edit_tags_popup = null;
var tag_style_popup = null;

var picker        = null;
var new_date      = null;
var new_day       = null;

// Since we'll only allow edits to one thing at a time,
// save the current values when we edit so that they can be restored
// if the user cancels or edits another one
var currently_editing = 0;
var select_tags       = 0;
var new_tag_style     = 1;

///////
// INITIALIZATION
///////

// Reload the list every 60 seconds (60,000 ms)
setInterval(reload, 60000);

$(document).ready(function() {
	$('#form').submit(dispatch);
	$(document.body).on('keydown', '.edit', function(event) {
		if (event.keyCode == 13)
			$('#form').submit();
	});

	$(window).keydown(key_handler);
});

///////
// KEYBOARD HANDLER
///////
function key_handler(event)
{
	key = event.keyCode;
	if (event.altKey && String.fromCharCode(key).toLowerCase() == 'n') // Alt+N (new)
		new_item_form();
	else if (key == 27)
		clear_edits();
}

///////
// SHOW OPTIONS
///////
function show_options()
{
	// Check if we already have this set up; if we do, no need to do this again
	if (options_box)
		return;

	options_box = new Box('options', 'Options', 'extra');

	var options_list = create_element({
		element: 'ul', id: 'optionslist', children: [
			{ element: 'li', children: [ { element: 'a', href: index_url + '#template', onclick: "return load('template')", text: 'Edit template' } ] }
		]
	});

	options_box.content.appendChild(options_list);
}

///////
// COLOR KEY
///////

function show_color_key()
{
	// Check if we already have this set up; if we do, no need to do it again
	if (color_key_box)
		return;

	color_key_box = new Box('colorkey', 'Color Key', 'extra');

	color_key_box.content.appendChild(create_element({
		element: 'table', id: 'colorkey',
		children: [
			{
				element: 'tr', children: [
					{ element: 'td', cssclass: 'future', text: 'Upcoming' },
					{ element: 'td', cssclass: 'future mark', text: 'Upcoming, marked' }
				]
			},
			{
				element: 'tr', children: [
					{ element: 'td', cssclass: 'today', text: 'Today' },
					{ element: 'td', cssclass: 'today mark', text: 'Today, marked' }
				]
			},
			{
				element: 'tr', children: [
					{ element: 'td', cssclass: 'past', text: 'Overdue' },
					{ element: 'td', cssclass: 'past mark', text: 'Overdue, marked' }
				]
			}
		]
	}));
}

///////
// POPULATE
// Clear the table and (re)populate it based on the 'items' object/array
///////
function populate(full)
{
	// Get the table body
	var table = document.getElementById('content');

	// Show initial/static boxes
	if (!template) {
		show_options();
		if (use_mark)
			show_color_key();
	}

	var tbody = document.createElement('tbody');

	delete used_tags;
	used_tags = new Hash();

	// Add rows
	var things = items.get_items();
	var len = things.length;
	for (var i = 0; i < len; i++) {
		var c = things[i];

		// Figure out if any of the item's tags match
		var itags = c.tags();
		var tlen  = itags.length;
		var ok    = (tlen == 0 && (show_tags.length == 0 || show_tags.hasItem(0)))  ? true : false;
		for (var j = 0; j < tlen; j++) {
			if (show_tags.length == 0 || show_tags.hasItem(itags[j]))
				ok = true;
			used_tags.setItem(itags[j], 1);
		}

		if (ok) {
			var row = tbody.insertRow(-1);
			populate_row(row, c);
		}
	}

	var originalBody = table.getElementsByTagName('tbody')[0];
	table.replaceChild(tbody, originalBody);

	items.clear_flags();

	highlight();
	sync_boxes();

	// If list is empty, show a message to that effect
	if (items.length == 0) {
		tbody.appendChild(create_element({
			element: 'tr', id: 'empty',
			children: [
				{ element: 'td', colspan: (use_mark == 1) ? 6 : 5, text: 'No items for this week' }
			]
		}));
	}

	populate_tag_selector();
}

function time_class(item)
{
	var today = new Date();

	if (item.date() && item.date().equals(today))
		return 'today';
	else if (item.date() && item.date() < today)
		return 'past';
	else if (item.date() && item.date() > today)
		return 'future';

	return 'undated';
}

function populate_row(row, item)
{
	if (!row)
		return;

	remove_all_children(row);

	row.setAttribute('id', 'item' + item.id());
	var cls = time_class(item);
	if (item.done())
		cls += ' done';
	if (item.marked())
		cls += ' mark';
	row.setAttribute('class', cls);

	// Create cell for 'done' box
	row.appendChild(create_element({
		element: 'td', cssclass: 'done',
		children: [
			{ element: 'input', type: 'checkbox', id: 'done' + item.id(), onclick: 'toggle_done(' + item.id() + ')' }
		]
	}));

	// Create cell for day & date
	var day_cell = {
		element: 'td', cssclass: 'day', onclick: 'show_date_edit(' + item.id() + ')',
		text: item.date() ? item.date().strftime(date_format) : (item.day() != null ? get_day_from_value(item.day()) : '--')
	};
	row.appendChild(create_element(day_cell));

	// Create cell for event
	var event_cell = {
		element: 'td', cssclass: 'event',
		children: [
			{ element: 'div', cssclass: 'tags', id: 'tags' + item.id(), children: [] }
		]
	};

	var tags_elems = {
		element: 'div', cssclass: 'tags', id: 'tags' + item.id(), children: []
	};

	var item_tags = item.tags();
	for (var j = 0; j < item_tags.length; j++) {
		var tag = tags.get(item_tags[j]);
		event_cell.children[0].children.push({ element: 'span', id: 'itemtag' + tag.id() + '_' + item.id(), cssclass: 'tag tag' + tag.style(), text: tag.name() });
	}

	event_cell.children[0].children.push({ element: 'img', cssclass: 'tagmenu', src: images_url + '/arrow.gif', id: 't' + item.id(), onclick: 'show_tags_menu(' + item.id() + ')' });
	event_cell.children.push({ element: 'div', cssclass: 'event', id: 'event' + item.id(), onclick: 'show_event_edit(' + item.id() + ')', text: item.event() });
	row.appendChild(create_element(event_cell));

	// Create cell for location
	row.appendChild(create_element({ element: 'td', cssclass: 'location', onclick: 'show_location_edit(' + item.id() + ')', text: item.location() }));

	// Create cell for start/end times
	var time_cell = {
		element: 'td', cssclass: 'times', onclick: 'show_times_edit(' + item.id() + ')',
		children: []
	}
	if (item.start() != -1)
		time_cell.children.push({ element: 'text', text: item.start() });
	if (item.end() != -1)
		time_cell.children.push({ element: 'text', text: String.fromCharCode(8211) + item.end() });
	row.appendChild(create_element(time_cell));

	if (use_mark)
		// Create cell for 'mark' button
		row.appendChild(create_element({
			element: 'td', cssclass: 'mark nodec',
			children: [
				{ element: 'input', type: 'button', cssclass: 'mark', value: '*', onclick: 'toggle_mark(' + item.id() + ')', id: 'mark' + item.id() }
			]
		}));
}

function populate_tag_selector()
{
	// Get count of untagged unfinished items
	var matching_items = items.filter_by_tag(null).filter_by_unfinished().get_items();

	var none_label = '[none]';
	if (matching_items.length > 0) {
		none_label += ' (' + matching_items.length + ')';
	}

	var tag_list = {
		element: 'ul', id: 'showtaglist', children: [
			{
				element: 'span', id: 'showtag0', onclick: 'toggle_tag_display(0)',
				cssclass: 'tag' + (show_tags.hasItem(0) ? '' : ' unselected'),
				text: none_label + (!show_tags.hasItem(0) ? '' : String.fromCharCode(10004))
			}
		]
	};

	var taglist = tags.items_name();
	for (var i = 0; i < taglist.length; i++) {
		var tag = taglist[i];

		if (!used_tags.hasItem(tag.id()))
			continue;

		matching_items = items.filter_by_tag(tag.name()).filter_by_unfinished().get_items();

		var label = tag.name();
		if (matching_items.length > 0) {
			label += ' (' + matching_items.length + ')';
		}

		tag_list.children.push({
			element: 'li',
			children: [ {
				element: 'span', id: 'showtag' + tag.id(), onclick: 'toggle_tag_display(' + tag.id() + ')',
				cssclass: 'tag tag' + tag.style() + (show_tags.hasItem(tag.id()) ? '' : ' unselected'),
				text: label + (!show_tags.hasItem(tag.id()) ? '' : String.fromCharCode(10004))
			} ]
		});
	}

	if (!tag_sel_box)
		tag_sel_box = new Box('showtags', 'Tags', 'extra');

	remove_all_children(tag_sel_box.content);
	tag_sel_box.content.appendChild(create_element(tag_list));
	tag_sel_box.content.appendChild(create_element({
		element: 'div', style: 'text-align: right',
		children: [
			{ element: 'a', id: 'edittagslink', href: 'javascript:edit_tags()', text: 'Edit Tags' }
		]
	}));
}

function toggle_tag_display(id)
{
	var tag = $('#showtag' + id);

	if (!show_tags.hasItem(id))
		show_tags.setItem(id, 1);
	else
		show_tags.removeItem(id);

	populate(true);
}

function clear_tag_display()
{
	for (var id in show_tags.items) {
		show_tags.removeItem(id);
		$('#showtag' + id).addClass('unselected');
	}
	populate(true);
}

function show_tags_menu(id)
{
	hide_tags_menu();

	select_tags = id;

	var item  = items.get(id);
	var itags = item.tags();

	pick_tags_popup = new Popup('picktags', 'Select tags', { shadow: true, onclose: hide_tags_menu, onresize: function(e) { setPosition($('#popup_picktags'), $('#t' + select_tags)); } });

	var content = {
		element: 'div', id: 'picktagslist', children: []
	};

	var taglist = tags.items_name();
	for (var i = 0; i < taglist.length; i++) {
		var tag = taglist[i];

		content.children.push({
			element: 'div',
			children: [
				{ element: 'input', type: 'checkbox', id: 'picktag' + tag.id(), checked: (itags.indexOf(tag.id()) != -1) },
				{ element: 'label', assoc: 'picktag' + tag.id(), onclick: function(has_tag, tag_id) { return function() { has_tag ? remove_item_tag(id, tag_id) : add_item_tag(id, tag_id); } }(itags.indexOf(tag.id()) != -1, tag.id()),
					children: [
						{ element: 'span', cssclass: 'tag tag' + tag.style(), text: tag.name() }
					]
				}
			]
		});
	}

	pick_tags_popup.content.appendChild(create_element(content));

	pick_tags_popup.content.appendChild(create_element({
		element: 'button', id: 'savetags' + id, onclick: 'save_item_tags(' + id + ')', text: 'Save'
	}));

	// Position it
	var img = $('#t' + id);
	img.addClass('show');
	var pos = img.offset();

	setPosition($('#popup_picktags'), img);
}

function hide_tags_menu()
{
	if (pick_tags_popup) {
		pick_tags_popup.close();
		delete pick_tags_popup;
	}

	if (select_tags)
		$('#t' + select_tags).removeClass('show');

	select_tags = 0;
}

function add_item_tag(item_id, tag_id)
{
	// Disable 'Save' button
	var save_button = document.getElementById('savetags' + item_id);
	save_button.disabled = true;
	save_button.innerHTML = 'Saving...';

	// Make Ajax request to add tag
	var params = $.extend({
		action:    'additemtag',
		item:      item_id,
		timestamp: last_timestamp,
		tag:       tag_id
	}, get_view());
	var $request = $.post(base_url, params).done(process);
}

function remove_item_tag(item_id, tag_id)
{
	// Disable 'Save' button
	var save_button = document.getElementById('savetags' + item_id);
	save_button.disabled = true;
	save_button.innerHTML = 'Saving...';

	// Make Ajax request to add tag
	var params = $.extend({
		action:    'delitemtag',
		item:      item_id,
		timestamp: last_timestamp,
		tag:       tag_id
	}, get_view());

	var $request = $.post(base_url, params).done(process);
}

function save_item_tags(id)
{
	// Disable the 'save' button (Todo #1473)
	var save_button = document.getElementById('savetags' + id);
	save_button.setAttribute('disabled', 'disabled');
	remove_all_children(save_button);
	save_button.appendChild(document.createTextNode('Saving...'));

	var new_tags = [];

	// Go through all of the tags and figure out which ones are checked
	for (var i = 0; i < tags.items().length; i++) {
		var tag = tags.items()[i];
		var tag_elem = document.getElementById('picktag' + tag.id());
		if (tag_elem.checked)
			new_tags.push(tag.id());
	}

	// Make Ajax request to save tags
	var params = $.extend({
		action:    'itemtags',
		id:        id,
		timestamp: last_timestamp,
		tags:      new_tags.join(',')
	}, get_view());
	var $request = $.post(base_url, params).done(process);
}

///////
// EDIT TAGS
///////
function edit_tags()
{
	if (edit_tags_popup) {
		edit_tags_popup.close();
		delete edit_tags_popup;
	}

	edit_tags_popup = new Popup('edittags', 'Edit Tags', { shadow: true, onresize: function(e) { setPosition($('#popup_edittags'), $('#edittagslink')); } });

	var form = {
		element: 'form', onsubmit: 'return save_tags()',
		children: [
			{ element: 'table', children: [] }
		]
	};

	var table = form.children[0].children;

	var taglist = tags.items_name();
	for (var i = 0; i < taglist.length; i++) {
		var tag = taglist[i];

		table.push({
			element: 'tr',
			children: [
				{
					element: 'td', id: 'tagname' + tag.id(), onclick: 'rename_tag(' + tag.id() + ')', cssclass: 'tagname',
					children: [
						{ element: 'span', cssclass: 'tag tag' + tag.style(), id: 'edittagname' + tag.id(), text: tag.name() }
					]
				},
				{
					element: 'td',
					children: [
						{
							element: 'span', id: 'edittag' + tag.id(), cssclass: 'dropdown tag tag' + tag.style(), style: 'cursor: pointer', text: String.fromCharCode(8194),
							onmouseover: 'show_dropdown_arrow(' + tag.id() + ')',
							onmouseout: 'hide_dropdown_arrow(' + tag.id() + ')',
							onclick: 'show_styles_dropdown(' + tag.id() + ')'
						}
					]
				},
				{
					element: 'td',
					children: [
						{
							element: 'a', href: 'javascript:remove_tag(' + tag.id() + ')',
							children: [
								{ element: 'img', src: images_url + '/remove.png' }
							]
						}
					]
				}
			]
		});
	}

	table.push({
		element: 'tr', id: 'addtag',
		children: [
			{
				element: 'td', colspan: 3,
				children: [
					{ element: 'a', href: 'javascript:add_tag_form()', text: 'Add tag' }
				]
			}
		]
	});

	edit_tags_popup.content.appendChild(create_element(form));

	// Position near the 'Edit tags' link
	setPosition($('#popup_edittags'), $('#edittagslink'));
}

function show_dropdown_arrow(id)
{
	var elem = $('#edittag' + id);

	elem.empty().text(String.fromCharCode(9663));
}

function hide_dropdown_arrow(id)
{
	var elem = $('#edittag' + id);

	elem.empty().text(String.fromCharCode(8194));
}

function show_styles_dropdown(id)
{
	hide_styles_dropdown();

	var tag = (id != -1) ? tags.get(id) : null;

	// Reset span's onclick
	var span = document.getElementById('edittag' + id);
	if (span)
		span.setAttribute('onclick', 'hide_styles_dropdown(' + id + ')');

	tag_style_popup = new Popup('tagstyles', 'Pick color', { shadow: true, onclose: hide_styles_dropdown, oncloseparam: id, onresize: function(e) { setPosition($('#popup_tagstyles'), $('#edittag' + id)); } });

	var table = { element: 'table', id: 'styletable', children: [] };

	for (var i = 0; i < 4; i++) {
		var row = { element: 'tr', children: [] };
		for (var j = 1; j <= 6; j++) {
			var style = (6 * i) + j;

			row.children.push({
				element: 'td',
				children: [
					{
						element: 'span', style: 'cursor: pointer; display: block; width: 1em', cssclass: 'tag tag' + style, onclick: 'set_tag_style(' + id + ',' + style + ')',
						text: ((tag && tag.style() == style) || (!tag && new_tag_style == style)) ? String.fromCharCode(10004) : 'a'
					}
				]
			});
		}
		table.children.push(row);
	}

	// Add 'no style' row
	table.children.push({
		element: 'tr',
		children: [
			{
				element: 'td', colspan: 6, onclick: 'set_tag_style(' + id + ',0)',
				text: (((!tag && new_tag_style == 0) || (tag && tag.style() == 0)) ? String.fromCharCode(10004) : '') + ' No style'
			}
		]
	});

	tag_style_popup.content.appendChild(create_element(table));

	// Set position
	setPosition($('#popup_tagstyles'), $('#edittag' + id));
}

function hide_styles_dropdown(id)
{
	if (id) {
		// Restore onclick handler
		var span = document.getElementById('edittag' + id);
		if (span)
			span.setAttribute('onclick', 'show_styles_dropdown(' + id + ')');
	}
}

function set_tag_style(tag_id, style)
{
	if (tag_style_popup) {
		tag_style_popup.close();
		delete tag_style_popup;
	}

	if (tag_id == -1) {
		new_tag_style = style;
		$('#edittag-1').removeClass().addClass('tag tag' + style);
		document.getElementById('addtagname').focus();
	} else {
		var tag = tags.get(tag_id);
		tag.set_style(style);

		var params = $.extend({
			action: 'savetag',
			id: tag_id,
			style: ((style == 0) ? -1 : style)
		}, get_view());
		var $request = $.post(base_url, params).done(load_tags);

		// Refresh tags
		refresh_tags();
	}
}

function refresh_tags()
{
	var alltags = document.getElementsByClassName('tag');

	var len = alltags.length;
	for (var i = 0; i < len; i++) {
		var id = alltags[i].getAttribute('id');
		if (!id)
			continue;
		var t = $('#' + id);
		if (!t)
			continue;

		var dropdown = 0;
		if (t.hasClass('dropdown'))
			dropdown = 1;

		var classes = t.get(0).className.split(" ");
		t.removeClass();
		for (var j = 0; j < classes.length; j++) {
			if (classes[j].match(/tag\d+/)) {
				var idc = id;
				var tid = idc.replace(/(.+?)(\d+)(_(.+))?/, "$2");
				var style = tags.get(tid).style();
				t.addClass('tag' + style);
				if (!dropdown)
					t.empty().text(tags.get(tid).name());
			} else
				t.addClass(classes[j]);
		}
	}
}

function rename_tag(id)
{
	hide_rename_tag();

	// Get cell
	var cell = document.getElementById('tagname' + id);

	// Suppress onclick handler
	cell.setAttribute('onclick', 'return false');

	// Remove existing content
	remove_all_children(cell);

	// Populate with the edit fields
	cell.appendChild(create_element({
		element: 'input', type: 'hidden', id: 'edittagid', value: id
	}));

	var tag = tags.get(id);

	cell.appendChild(create_element({
		element: 'input', type: 'text', cssclass: 'tagname', id: 'edittagname', value: tag.name()
	}));

	document.getElementById('edittagname').focus();
}

function hide_rename_tag()
{
	if (!document.getElementById('edittagid'))
		return;

	var id = parseInt(document.getElementById('edittagid').value);

	if (id == -1)
		hide_add_tag();
	else {
		// Get affected cell
		var cell = document.getElementById('tagname' + id);

		// Restore onclick handler
		cell.setAttribute('onclick', 'rename_tag(' + id + ')');

		// Restore appearance
		remove_all_children(cell);

		var tag  = tags.get(id);

		cell.appendChild(create_element({
			element: 'span', cssclass: 'tag tag' + tag.style(), text: tag.name()
		}));
	}
}

function add_tag_form()
{
	// Get row with 'add tag' link
	var row = document.getElementById('addtag');

	// Empty it out
	remove_all_children(row);

	new_tag_style = 1;

	// Add fields for info
	row.appendChild(create_element({
		element: 'td',
		children: [
			{ element: 'input', type: 'text', cssclass: 'tagname', id: 'addtagname' },
			{ element: 'input', type: 'hidden', id: 'edittagid', value: '-1' }
		]
	}));

	row.appendChild(create_element({
		element: 'td',
		children: [
			{
				element: 'span', id: 'edittag-1', cssclass: 'dropdown tag tag1', style: 'cursor: pointer',
				onmouseover: 'show_dropdown_arrow(-1)',
				onmouseout: 'hide_dropdown_arrow(-1)',
				onclick: 'show_styles_dropdown(-1)',
				text: String.fromCharCode(8194)
			}
		]
	}));

	document.getElementById('addtagname').focus();
}

function hide_add_tag()
{
	var row = document.getElementById('addtag');

	remove_all_children(row);

	row.appendChild(create_element({
		element: 'td', colspan: 4,
		children: [
			{ element: 'a', href: 'javascript:add_tag_form()', text: 'Add tag' }
		]
	}));
}

function save_tags()
{
	var params = { };

	if (!document.getElementById('edittagid'))
		return false;

	var id = parseInt(document.getElementById('edittagid').value);

	// Figure out if we're adding a new tag or updating an existing one
	if (id == -1) {
		// Adding new tag

		var name = document.getElementById('addtagname').value;

		if (name.trim()) {
			params = {
				action: 'addtag',
				name: name,
				style: new_tag_style
			};
			hide_add_tag();
		}
	} else {
		// Updating existing tag

		var name = document.getElementById('edittagname').value;

		if (name.trim()) {
			params = {
				action: 'savetag',
				id: id,
				name: name
			};
			hide_rename_tag();
		}
	}

	$.post(base_url, params).done(function(data) {
		load_tags(data);
		edit_tags();
		refresh_tags();
		populate_tag_selector();
	});

	return false;
}

function remove_tag(id)
{
	var tag = tags.get(id);

	if (confirm("Are you sure you want to remove the tag '" + tag.name() + "'?")) {
		var params = $.extend({
			action: 'removetag',
			id: id,
		}, get_view());
		var $request = $.post(base_url, params).done(function(data) {
			process(data);
			edit_tags();
			populate_tag_selector();
		});
	}
}

///////
// RELOAD DATA
///////
function reload()
{
	// If we're editing something, don't reload
	if (currently_editing != 0)
		return;

	var params = {
		action:    'load',
		view:      get_view().view || '',
		timestamp: last_timestamp
	};
	var $request = $.get(base_url, params).done(process);
}

///////
// HIGHLIGHT CURRENT DAY'S ITEMS
///////
function highlight()
{
	if (template)
		return;

	var today = new Date();

	// Get table
	var table = document.getElementById('content');

	var rows = table.getElementsByTagName('tr');
	for (var i = 1; i < rows.length; i++) {
		var id  = rows[i].getAttribute('id');
		var row = $('#' + id);

		var item = items.get(id.replace(/item/, ''));
		if (!item)
			continue;

		var done = row.hasClass('done');
		var mark = row.hasClass('mark');

		row.removeClass();
		row.addClass(time_class(item));

		if (done)
			row.addClass('done');
		if (mark)
			row.addClass('mark');
	}

	// Set page title
	if (!template && get_view().view == null)
		document.title = ('Todo - ' + (new Date()).strftime('%Y-%m-%d'));
	else if (template)
		document.title = 'Todo - Template';
	else {
		var start  = new Date(view_date);
		start.setDate(start.getDate() - start.getDay());

		document.title = ('Todo - Week of ' + start.strftime('%Y-%m-%d'));

	}
}

///////
// SYNCHRONIZE CHECKBOXES
///////
function sync_boxes()
{
	// Get table
	var table = document.getElementById('content');

	var rows = table.getElementsByTagName('tr');
	for (var i = 1; i < rows.length; i++) {
		var row = rows[i];
		var id  = row.getAttribute('id').replace(/item/, '')
		var jid = '#item' + id;
		row = $(jid);

		var done = row.hasClass('done');

		var box = document.getElementById('done' + id);

		if (box)
			box.checked = done;
	}
}

///////
// DISPATCH
///////
function dispatch()
{
	// If the form is being submitted but nothing is being edited, assume we're adding a new item
	if (currently_editing == -1) {
		submit_new_item();
	} else {
		// Figure out what's changing
		var update_event = 0, update_location = 0, update_times = 0;
		var changed  = 0;	// bitwise; 1 == event, 2 == location, 4 == times
		var event, location, start, end;

		// Look for an event textbox
		var event_box = document.getElementById('event');
		if (event_box) {
			event = event_box.value;
			if (!event || event.trim().length == 0) {
				delete_item(currently_editing);
				return;
			}
			update_event = 1;
			changed += 1;
		}

		// Look for a location textbox
		var location_box = document.getElementById('location');
		if (location_box) {
			location = location_box.value;
			update_location = 1;
			changed += 2;
		}

		// Look for a start time textbox
		var start_box = document.getElementById('start');
		var end_box   = document.getElementById('end');
		if (start_box) {
			start = start_box.value;
			end   = end_box.value;
			update_times = 1;
			changed += 4;
		}

		// Build param object
		var params = $.extend({
			action: 'save',
			id: currently_editing,
			changed: changed
		}, get_view());
		if (update_event)
			params['event'] = event;
		if (update_location)
			params['location'] = location;
		if (update_times) {
			params['start'] = start;
			params['end']   = end;
		}

		params.timestamp = last_timestamp;

		// Replace the row with a processing message
		var row = document.getElementById('item' + currently_editing);
		var len = row.getElementsByTagName('td').length;
		for (var i = 0; i < len; i++)
			row.removeChild(row.getElementsByTagName('td')[0]);

		row.appendChild(create_element({ element: 'td', colspan: use_mark ? 6 : 5, cssclass: 'nodec', style: 'font-style: italic; text-align: center', text: 'Processing...' }));

		var $request = $.post(base_url, params).done(process);
	}
	return false;
}

function new_item_form()
{
	clear_edits();
	create_hidden_submit();

	// Only ever have one "new" row up at a time
	var already_row = document.getElementById('newrow');

	if (already_row) {
		return;
	}

	currently_editing = -1;

	// Get the table
	var table = document.getElementById('content');
	// Get tbody
	var tbody = table.getElementsByTagName('tbody')[0];

	// Add a new row to the table
	var row = {
		element: 'tr', id: 'newrow',
		children: [
			// Date column
			{
				element: 'td', colspan: 2,
				children: [
					{ element: 'input', type: 'text', id: 'newdate', children: [ ], readonly: true, onclick: new_item_show_picker, onfocus: new_item_show_picker }
				]
			},
			// Event column
			{
				element: 'td',
				children: [
					{ element: 'input', type: 'text', id: 'newevent', cssclass: 'edit', style: 'width: 97%' }
				]
			},
			// Location column
			{
				element: 'td',
				children: [
					{ element: 'input', type: 'text', id: 'newlocation', cssclass: 'edit', style: 'width: 97%' }
				]
			},
			// Times column
			{
				element: 'td',
				children: [
					{ element: 'input', type: 'text', id: 'newstart', cssclass: 'time edit' },
					{ element: 'text', text: String.fromCharCode(8211) },
					{ element: 'input', type: 'text', id: 'newend', cssclass: 'time edit' }
				]
			}
		]
	}

	// Add empty column for "mark", if that feature is used
	if (use_mark)
		row.children.push({ element: 'td', text: ' ' });

	// Add the new row to the table
	tbody.appendChild(create_element(row));

	// Show date picker
	new_item_show_picker();
}

function new_item_show_picker()
{
	new_date = new_day = null;

	if (picker) {
		picker.hide();
		delete picker;
	}

	var start_date = null, start_day = 0;
	if (!template) {
		if (get_view().view == null) {
			start_date = new Date();
			start_day = start_date.getDay();
			start_date.setDate(start_date.getDate() - start_date.getDay());
		} else {
			start_date = date_from_string(get_view().view);
			start_date.setDate(start_date.getDate() - start_date.getDay());
		}
	}

	picker = new Picker({ anim_callback: scroll_to_new, closed: move_to_event, any_date: !template, start_date: start_date, start_day: start_day });
	picker.show($('#newdate'), new_item_select_date);
}

function move_to_event()
{
	var event_box = document.getElementById('newevent');

	if (event_box)
		event_box.focus();
}

function scroll_to_new()
{
	// Scroll to show 'new' row
	var newrow = document.getElementById('newrow');
	var picker = document.getElementById('picker');
	window.scrollTo(0, newrow.offsetTop + 200);
}

function new_item_select_date(day, date)
{
	var d;

	if (template)
		return template_new_item_select_day(day);

	if (typeof day !== 'undefined' && day !== null && day != -1) {
		if (get_view().view == null) {
			var today = new Date();
			var start = new Date();
			start.setDate(start.getDate() - start.getDay());

			if (day < today.getDay())
				day += 7;

			d = start;
			d.setDate(d.getDate() + day);
		} else {
			var view  = get_view(true).view;
			var start = date_from_string(view);
			start.setDate(start.getDate() - start.getDay());

			if (day >= 0) {
				d = start;
				d.setDate(start.getDate() + day);
			}
		}
	} else if (typeof date !== 'undefined' && date !== null) {
		d = date_from_string(date);
	}

	var elem = document.getElementById('newdate');
	if (d)
		elem.value = d.strftime(date_format);
	else
		elem.value = '--';

	new_date = d;
}

function template_new_item_select_day(day)
{
	var value = '--';

	if (day != -1) {
		// Build a fake Date object, to be able to use strftime()
		var date = new Date();
		date.setDate(date.getDate() - date.getDay() + day);

		value = date.strftime('%a');
	}
	new_day = day;

	var elem = document.getElementById('newdate');
	elem.value = value;
}

function submit_new_item()
{
	// Get values
	var event_box    = document.getElementById('newevent');
	var location_box = document.getElementById('newlocation');
	var start_box    = document.getElementById('newstart');
	var end_box      = document.getElementById('newend');

	var event    = event_box.value;
	var location = location_box.value;
	var start    = start_box.value;
	var end      = end_box.value;

	// Make sure the important fields have values (Todo #1367)
	if (!event) {
		alert("Missing some key information!");
		return;
	}

	var params = $.extend({
		action:    'add',
		date:      template ? new_day : (new_date ? new_date.strftime('%Y-%m-%d') : null),
		event:     event,
		location:  location,
		start:     start,
		end:       end,
		timestamp: last_timestamp
	}, get_view());
	var $request = $.post(base_url, params).done(process);

	// Provide some feedback to let the user know that something's happening
	var row = document.getElementById('newrow');
	var parent = row.parentNode;
	parent.removeChild(row);

	parent.appendChild(create_element({
		element: 'tr', id: 'newrow', cssclass: 'front',
		children: [
			{ element: 'td', colspan: use_mark ? 6 : 5, style: 'font-style: italic; text-align: center', text: 'Processing...' }
		]
	}));
}

///////
// EDITING
///////

function show_date_edit(id)
{
	// Clear other edits
	clear_edits(id);

	// Get item
	var item = items.get(id);

	// Create submit button
	create_hidden_submit();

	// Get the row with this ID
	var row = $('#item' + id);

	// Get the date cell
	var cell = $('#item' + id + '>td:eq(1)');

	// Temporarily suspend the "onlick" for this cell
	cell.get(0).setAttribute('onclick', 'return false');

	// Don't show strikethrough while editing
	cell.addClass('nodec');

	currently_editing = id;

	if (picker) {
		picker.hide();
		delete picker;
	}

	var start_date = null, start_day = 0;
	if (!template) {
		if (get_view().view == null) {
			start_date = new Date();
			start_day = start_date.getDay();
			start_date.setDate(start_date.getDate() - start_date.getDay());
		} else {
			start_date = date_from_string(get_view().view);
			start_date.setDate(start_date.getDate() - start_date.getDay());
		}
	}
	picker = new Picker({ date: item.date(), day: item.day(), closed: function(cancel) { datepicker_closed(id, cancel); }, any_date: !template, start_date: start_date, start_day: start_day });
	picker.show(cell, function(day, date) { set_date(id, day, date); });
}

function datepicker_closed(id, cancel)
{
	if (!cancel)
		return;

	// Restore onclick handler for cell if user canceled
	// Get the row with this ID
	var row = $('#item' + id);

	// Get the date cell
	var cell = $('#item' + id + '>td:eq(1)');

	// Temporarily suspend the "onlick" for this cell
	cell.get(0).setAttribute('onclick', 'show_date_edit(' + id + ')');
}

function set_date(id, day, date)
{
	var d;

	var cell = document.getElementById('item' + id).getElementsByTagName('td')[1];

	show_spinner(cell);

	if (template) {
		return template_set_day(id, day);
	} else if (typeof day !== 'undefined' && day !== null && day != -1) {
		if (get_view().view == null) {
			var today = new Date();
			var start = new Date();
			start.setDate(start.getDate() - start.getDay());

			if (day < today.getDay())
				day += 7;

			d = start;
			d.setDate(d.getDate() + day);
		} else {
			var view  = get_view(true).view;
			var start = date_from_string(view);
			start.setDate(start.getDate() - start.getDay());

			if (day >= 0) {
				d = start;
				d.setDate(start.getDate() + day);
			}
		}
	} else if (typeof date !== 'undefined' && date !== null) {
		d = date_from_string(date);
	}

	var params = $.extend({
		action:    'date',
		id:        id,
		date:      d ? d.strftime('%Y-%m-%d') : '',
	}, get_view());
	var $request = $.post(base_url, params).done(process);
}

function template_set_day(id, day)
{
	var params = $.extend({
		action:    'day',
		id:        id,
		day:       day,
		timestamp: last_timestamp
	}, get_view());
	var $request = $.post(base_url, params).done(process);
}

function show_event_edit(id)
{
	// Clear other edits
	clear_edits(id);

	// Get item
	var item = items.get(id);

	if (!item)
		return;

	// Create submit button
	create_hidden_submit();

	// Get the row we're editing in
	var row  = $('#item' + id);

	// Get the event cell
	var cell = $('#item' + id + ' > td:eq(2)');

	var event = $('#event' + id);

	// Make sure we don't call this function again while we're editing
	event.get(0).setAttribute('onclick', 'return false;');

	// Save tags, if any
	var itags = $('#tags' + id);

	currently_editing = id;

	// Don't indicate done when editing the event
	cell.addClass('nodec');

	// Create a new textbox
	var width = 97 - ((itags.width() / cell.width()) * 100);
	var textbox = create_element({
		element: 'input', type: 'text', id: 'event', cssclass: 'edit', style: 'width: ' + width + '%', value: item.event()
	});

	event.empty();
	event.append(textbox);

	// Focus the new box
	textbox.focus();

	// Select the text in the box
	textbox.select();
}

function show_location_edit(id)
{
	// Clear other edits
	clear_edits(id);

	// Get item
	var item = items.get(id);

	if (!item)
		return;

	// Create submit button
	create_hidden_submit();

	// Get the location cell
	var cell = $('#item' + id + '>td:eq(3)');

	// Make sure we don't call this function again if we click in the textbox
	cell.get(0).setAttribute('onclick', 'return false;');

	// Don't strike through the textbox
	cell.addClass('nodec');

	currently_editing = id;

	// Create new textbox
	var textbox = create_element({
		element: 'input', type: 'text', id: 'location', cssclass: 'edit', style: 'width: 97%', value: item.location() || ''
	});

	cell.empty();
	cell.append(textbox);

	// Focus the new textbox
	textbox.focus();

	// Select the text in the box
	textbox.select();
}

function show_times_edit(id)
{
	// Clear other edits
	clear_edits(id);

	// Get this item
	var item = items.get(id);

	if (!item)
		return;

	// Create submit button
	create_hidden_submit();

	// Get the times cell
	var cell = $('#item' + id + '>td:eq(4)');

	// Make sure we don't call this function again while we're editing
	cell.get(0).setAttribute('onclick', 'return false;');

	// Don't show strikethrough while editing
	cell.addClass('nodec');

	currently_editing = id;

	// Create a new start time textbox
	var startbox = create_element({
		element: 'input', type: 'text', id: 'start', cssclass: 'time edit', value: (item.start() != -1) ? item.start() : ''
	});

	// Create a new end time textbox
	var endbox = create_element({
		element: 'input', type: 'text', id: 'end', cssclass: 'time edit', value: (item.end() != -1) ? item.end() : ''
	});

	cell.empty();
	cell.append(startbox);
	cell.append(create_element({ element: 'span', text: String.fromCharCode(8211) }));
	cell.append(endbox);

	// Focus the start time box
	startbox.focus();

	// Select the text in the box
	startbox.select();
}

///////
// TOGGLE "DONE" STATE
///////
function toggle_done(id)
{
	var params = $.extend({
		action:    'done',
		id:        id,
		timestamp: last_timestamp
	}, get_view());
	var $request = $.post(base_url, params).done(process);

	// Get the current row
	var row = document.getElementById('item' + id);

	// Show 'processing' image in 'done' cell
	show_spinner(row.getElementsByTagName('td')[0]);
}

///////
// TOGGLE "MARKED" STATE
///////
function toggle_mark(id)
{
	if (use_mark) {
		var params = $.extend({
			action:    'mark',
			id:        id,
			timestamp: last_timestamp
		}, get_view());
		$.post(base_url, params).done(process);

		// Get the current row
		var row = document.getElementById('item' + id);

		// Show 'processing' image in 'mark' cell
		show_spinner(row.getElementsByTagName('td')[5]);
	}
}

///////
// DELETE ITEM
///////
function delete_item(id)
{
	// remove the row for this item
	var row = document.getElementById('item' + id);
	row.parentNode.removeChild(row);

	var params = $.extend({
		action:    'delete',
		id:        id,
		timestamp: last_timestamp
	}, get_view());
	var $request = $.post(base_url, params).done(process);

	currently_editing = 0;
}

///////
// UPDATE PREVIOUS/NEXT LINKS
///////
function update_links()
{
	var view = get_view(true).view;

	// Get table
	var table = document.getElementById('weeks');

	if (view && view == 'template') {
		table.className = 'hidden';
		return;
	}

	table.className = '';

	var parts;
	var d;

	if (view && (parts = view.match(/(\d{4})-(\d{2})-(\d{2})/)))
		d = date_from_string(view);
	else if (view_date)
		d = view_date;

	if (d) {
		var start = new Date(d);
		start.setDate(d.getDate() - d.getDay());

		var prev = new Date(start);
		prev.setDate(start.getDate() - 7);

		var next = new Date(start);
		next.setDate(start.getDate() + 7);

		var prev_link = document.getElementById('prevweek');
		prev_link.setAttribute('href', index_url + '#' + prev.strftime('%Y%m%d'));
		prev_link.onclick = function() { return load(prev); };
		prev_link.innerHTML = 'Week of ' + prev.strftime('%Y-%m-%d');

		var next_link = document.getElementById('nextweek');
		next_link.setAttribute('href', index_url + '#' + next.strftime('%Y%m%d'));
		next_link.onclick = function() { return load(next); };
		next_link.innerHTML = 'Week of ' + next.strftime('%Y-%m-%d');

		var curr_link = document.getElementById('currweek');

		// Figure out if we're in the current week
		var curr_start = new Date();
		curr_start.setDate(curr_start.getDate() - curr_start.getDay());

		if (curr_start.equals(start)) {
			// In current week; don't show 'view current week' link
			curr_link.className = 'hidden';
		} else {
			// Viewing some other week; show 'view current week' link

			curr_link.className = '';
			curr_link.setAttribute('href', index_url + '#' + curr_start.strftime('%Y%m%d'));
		}
	}
}

///////
// MISC FUNCTIONS
///////
function create_hidden_submit()
{
	// Check if the hidden submit button already exists
	var button = document.getElementById('submit');

	if (button)
		return;

	var elem = {
		element: 'input', type: 'submit', id: 'submit', style: 'display: none'
	};

	button = create_element(elem);

	// Get the document's form
	var form = document.getElementById('form');

	// Add the button to the form
	form.appendChild(button);
}

function clear_edits(id)
{
	// Reset any items in an "edit" state

	// Remove the add bar, if it's around
	var add_row = document.getElementById('newrow');

	if (add_row)
		add_row.parentNode.removeChild(add_row);

	// Remove the hidden submit button, if it's around
	var button = document.getElementById('submit');
	if (button)
		button.parentNode.removeChild(button);

	if (currently_editing == -1)
		currently_editing = 0;
	if (currently_editing == 0 || currently_editing == id)
		return;

	var item = items.get(currently_editing);
	var row  = document.getElementById('item' + currently_editing);

	populate_row(row, item);

	currently_editing = 0;

	highlight();
	sync_boxes();
}

function get_day_from_value(value)
{
	// For some reason, switch/case doesn't want to work here
	if (value == ((undated_last == 1) ? 7 : -1)) {
		return '--';
	} else if (value == 0) {
		return 'Sun';
	} else if (value == 1) {
		return 'Mon';
	} else if (value == 2) {
		return 'Tue';
	} else if (value == 3) {
		return 'Wed';
	} else if (value == 4) {
		return 'Thu';
	} else if (value == 5) {
		return 'Fri';
	} else if (value == 6) {
		return 'Sat'
	} else {
		return '--';
	}
}

///////
// SHOW 'PROCESSING' IMAGE
///////
function show_spinner(elem)
{
	// Create spinner
	var spinner = create_element({ element: 'img', src: images_url + '/processing.gif' });

	// Clear element
	remove_all_children(elem);

	// Show spinner
	elem.appendChild(spinner);
}

///////
// POSITIONING
///////
function setPosition(elem, near)
{
	if (!elem || !near)
		return;

	var scroll_top;
	var scroll_left;
	var window_width  = $(window).width();
	var window_height = $(window).height();
	var elem_height   = elem.outerHeight(true);
	var elem_width    = elem.outerWidth(true);

	// Position right below the target
	var offset = near.offset();
	var x_pos  = offset.left;
	var y_pos  = offset.top + near.height();

	// Set y-axis position
	scroll_top = $(window).scrollTop();

	// Check if element needs additional positions
	if (window_height < elem_height)
		// Element is larger than viewable window; position it at the top of the visible area
		y_pos = scroll_top;
	else if (window_height + scroll_top < y_pos + elem_height)
		// Element extends beyond bottom of window; position it so its bottom aligns with the bottom of the window
		y_pos -= y_pos + elem_height - (window_height + scroll_top) + 5;

	// Set x-axis position
	scroll_left = $(window).scrollLeft();
	if (window_width + scroll_left < x_pos + elem_width)
		// Element extends beyond right of window; shift the element to the left until it fits
		x_pos -= x_pos + elem_width - (window_width + scroll_left) + 5;

	// Set position
	elem.css({left: x_pos, top: y_pos});
}

///////
// HELPER FUNCTIONS
///////

function get_view(always_return_date)
{
	if (location.hash) {
		var matches = location.hash.match(/#(\d{4})(\d{2})(\d{2})/);
		if (matches && matches.length > 0) {
			var view = matches[1] + '-' + matches[2] + '-' + matches[3];
			return { view: view };
		} else if (location.hash.match(/#template/))
			return { view: 'template' };
	}
	if (view_date && always_return_date)
		return { view: view_date.strftime('%Y-%m-%d') };
	return { view: null };
}

function date_from_string(str)
{
	var parts = str.split(/-/);
	return new Date(parts[0], parts[1] - 1, parts[2]);
}

function remove_all_children(elem)
{
	if (!elem)
		return;

	var len = elem.childNodes.length;
	for (var i = 0; i < len; i++)
		elem.removeChild(elem.childNodes[0]);
}

String.prototype.trim = function() {
	return this.replace(/^\s+|\s+$/g,"");
}
String.prototype.ltrim = function() {
	return this.replace(/^\s+/,"");
}
String.prototype.rtrim = function() {
	return this.replace(/\s+$/,"");
}

if (!Array.indexOf) {
	Array.prototype.indexOf = function(obj) {
		for (var i = 0; i < this.length; i++)
			if(this[i] == obj)
				return i;
		return -1;
	}
}

Date.prototype.equals = function(date)
{
	if (this.getFullYear() == date.getFullYear() && this.getMonth() == date.getMonth() && this.getDate() == date.getDate())
		return true;
	return false;
}
