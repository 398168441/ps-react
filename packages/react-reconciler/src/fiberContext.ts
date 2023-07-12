import {ReactContext} from 'shared/ReactTypes'

let prevContextValue: any = null
const prevContextValueStack: any[] = []

/**
 * JSX结构固定
 * Provider的beginWork和completeWork一一对应
 * prevContextValue的值跟随栈而变化
 */

export function pushProvider<T>(context: ReactContext<T>, newValue: T) {
	prevContextValueStack.push(prevContextValue)

	prevContextValue = context._crrentValue
	context._crrentValue = newValue
}

export function popProvider<T>(context: ReactContext<T>) {
	context._crrentValue = prevContextValue

	prevContextValue = prevContextValueStack.pop()
}
