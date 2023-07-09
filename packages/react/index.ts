//  React
import currentDispatcher, {
	resolveDispatcher,
	Dispatcher
} from './src/currentDispatcher'
import {jsxDEV, jsx, isValidElement as isValidElementFn} from './src/jsx'

/**
 * 这里暴露出去的useState就是 当前使用的hooks的集合中的useState
 * 这样每个地方的useState就是当时所在上下文的useState
 * 比如如果是mount阶段，取到的就是renderWithHooks文件中mountState
 */
export const useState: Dispatcher['useState'] = (initialState) => {
	const dispatcher = resolveDispatcher()
	return dispatcher.useState(initialState)
}

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
	const dispatcher = resolveDispatcher()
	return dispatcher.useEffect(create, deps)
}

// 内部数据共享层
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher
}

export const version = '0.0.0'
//	todo 根据环境来决定用jsx/jsxDEV
export const createElement = jsx

export const isValidElement = isValidElementFn
