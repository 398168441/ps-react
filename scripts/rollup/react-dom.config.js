import generatePackageJson from 'rollup-plugin-generate-package-json'
import alias from '@rollup/plugin-alias'

import {getPackageJson, resolvePkgPath, getBaseRollupPlugins} from './utils'

const {name, module, peerDependencies} = getPackageJson('react-dom')
//	react-dom 包路径
const pkgPath = resolvePkgPath(name)
// react-dom 产物路径
const pkgDistPath = resolvePkgPath(name, true)

export default [
	// react-dom
	{
		input: `${pkgPath}/${module}`,
		output: [
			{
				file: `${pkgDistPath}/index.js`,
				name: 'index.js',
				format: 'umd'
			},
			{
				file: `${pkgDistPath}/client.js`,
				name: 'client.js',
				format: 'umd'
			}
		],
		// 希望react和react-dom共享【共享数据层__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED】
		// 所以react-dom打包时不希望包含react的代码
		external: [...Object.keys(peerDependencies)],
		plugins: [
			...getBaseRollupPlugins(),
			//	打包时识别各模块中 import xx from 'hostConfig'的路径
			alias({
				hostConfig: `${pkgPath}/src/hostConfig.ts`
			}),
			generatePackageJson({
				inputFolder: pkgPath,
				outputFolder: pkgDistPath,
				baseContents: ({name, description, version}) => ({
					name,
					description,
					version,
					peerDependencies: {
						// 让react的version和react-dom的version保持一直
						react: version
					},
					main: 'index.js'
				})
			})
		]
	}
]
