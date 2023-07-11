import {Action} from 'shared/ReactTypes'
export interface Dispatcher {
	useState: <T>(initialState: () => T | T) => [T, Dispatch<T>]
	useEffect: (callback: () => void | void, deps: any[] | void) => void
	useTransition: () => [boolean, (callback: () => void) => void]
	useRef: <T>(initialValue: T) => {current: T}
}

export type Dispatch<State> = (action: Action<State>) => void

/**
 * 当前使用的hooks的集合
 */
const currentDispatcher: {current: Dispatcher | null} = {
	current: null
}

export const resolveDispatcher = (): Dispatcher => {
	const dispatcher = currentDispatcher.current
	/**
	 * 如果不再函数组件这个上下文中
	 * 这个dispatcher应该是没有被赋值的
	 * 也就是reconcile中的各阶段的hooks的实现是不会指向currentDispacher这个hooks的集合
	 */
	if (dispatcher === null) {
		throw new Error('hook只能在函数组件中执行')
	}
	return dispatcher
}

export default currentDispatcher
