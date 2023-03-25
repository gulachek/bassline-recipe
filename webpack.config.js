const path = require('path');

function resolve(p)
{
	return path.resolve(__dirname, p);
}

module.exports = {
	entry: {
		react: ['react', 'react-dom'],
		recipeEdit: {
			import: resolve('static_src/recipeEdit.tsx'),
			filename: '[name].js',
			dependOn: ['react']
		},
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: 'ts-loader',
				exclude: /node_modules/
			},
			{
				test: /\.s?css$/i,
				use: [
					{
						loader: "style-loader",
						options: { injectType: "linkTag" }
					},
					{
						loader: "file-loader",
						options: { name: '[name].css' },
					},
					"sass-loader",
				],
					                                                                 },
		]
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js'],
	},
	output: {
		path: path.resolve(__dirname, 'assets')
	}
};
