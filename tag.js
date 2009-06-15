function Tag(id, name, style)
{
	var m_id    = id;
	var m_name  = name;
	var m_style = style;

	this.id = function()
	{
		return m_id;
	}

	this.name = function()
	{
		return m_name;
	}

	this.style = function()
	{
		return m_style;
	}

	this.set_style = function(style)
	{
		if (style >= 0 && style <= 24)
			m_style = style;
	}
}

function Tags()
{
	var m_tags = [];

	this.add = function(t)
	{
		m_tags.push(t);
	}

	this.clear = function()
	{
		delete m_tags;
		m_tags = [];
	}

	this.items = function()
	{
		return m_tags;
	}

	this.items_name = function()
	{
		var by_name = m_tags.slice();
		return by_name.sort(
			function(a, b)
			{
				var x = a.name().toLowerCase();
				var y = b.name().toLowerCase();
				return ((x < y) ? -1 : ((x > y) ? 1 : 0));
			}
		);
	}

	this.get = function(id)
	{
		for (var i = 0; i < m_tags.length; i++)
			if (m_tags[i].id() == id)
				return m_tags[i];
		return null;
	}

	this.get_name = function(name)
	{
		for (var i = 0; i < m_tags.length; i++)
			if (m_tags[i].name() == name)
				return m_tags[i];
		return null;
	}
}
