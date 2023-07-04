import generatePackageJson from 'rollup-plugin-generate-package-json'

import {getPackageJson, resolvePkgPath, getBaseRollupPlugins} from './utils'

const {name, module} = getPackageJson('react')
//	react 包路径
const pkgPath = resolvePkgPath(name)
// react 产物路径
const pkgDistPath = resolvePkgPath(name, true)

export default [
	// react
	{
		input: `${pkgPath}/${module}`,
		output: {
			file: `${pkgDistPath}/index.js`,
			name: 'React',
			format: 'umd'
		},
		plugins: [
			...getBaseRollupPlugins(),
			generatePackageJson({
				inputFolder: pkgPath,
				outputFolder: pkgDistPath,
				baseContents: ({name, description, version}) => ({
					name,
					description,
					version,
					main: 'index.js'
				})
			})
		]
	},
	// jsx-runtime
	{
		input: `${pkgPath}/src/jsx.ts`,
		output: [
			{
				file: `${pkgDistPath}/jsx-runtime.js`,
				name: 'jsx-runtime',
				format: 'umd'
			},
			{
				file: `${pkgDistPath}/jsx-dev-runtime.js`,
				name: 'jsx-dev-runtime',
				format: 'umd'
			}
		],
		plugins: [...getBaseRollupPlugins()]
	}
]
