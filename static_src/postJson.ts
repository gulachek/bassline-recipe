type JSONScalar = string|number|boolean;

interface IJsonPost
{
	body: object;
	query?: { [key: string]: JSONScalar };
}

export async function postJson<TResponse>(path: string, post: IJsonPost): Promise<TResponse>
{
	const { body, query } = post;

	const uri = new URL(path, document.baseURI);
	
	if (query)
	{
		for (const key in query)
		{
			if (query.hasOwnProperty(key))
				uri.searchParams.set(key, query[key].toString());
		}
	}
	
	const response = await fetch(uri, {
		method: 'POST',
		mode: 'same-origin',
		cache: 'no-cache',
		credentials: 'same-origin',
		headers: {
			'Content-Type': 'application/json'
		},
		redirect: 'follow',
		body: JSON.stringify(body)
	});

	return response.json() as TResponse;
}
