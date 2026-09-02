"use client";

type Props = {
	data: any;
};

export function JSONPreview({ data }: Props) {
	return (
		<pre className="text-xs bg-muted p-4 rounded overflow-auto">
			{JSON.stringify(data, null, 2)}
		</pre>
	);
}
