export type Type = any
export type Key = any
export type Ref = {current: any} | ((instance: any) => void) | null
export type Props = any
export type ElementType = any

export interface ReactElementType {
	$$typeof: symbol | number
	type: ElementType
	key: Key
	props: Props
	ref: Ref
	__mark: string
}

/**
 * 对应两种触发更新的方式
 * setState(x) 中x可以会一个变量或者一个函数
 */
export type Action<State> = State | ((preState: State) => State)

export type ReactContext<T> = {
	$$typeof: symbol | number
	Provider: ReactProviderType<T> | null
	_crrentValue: T
}

export type ReactProviderType<T> = {
	$$typeof: symbol | number
	_context: ReactContext<T>
}
