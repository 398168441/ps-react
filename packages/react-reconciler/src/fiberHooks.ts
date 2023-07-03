import {FiberNode} from './fiber'

// 当前正在render的fiber
let currentlyRenderingFiber: FiberNode | null = null

// 用来指向正在处理的hook
// let workInProgressHook: Hook | null = null

// 满足所有hook的类型 useState useCallback useEffect...
export interface Hook {
	// 对于不同hook memoizedState 保存不同的状态
	memoizedState: any
	// 能触发更新
	updateQueue: unknown
	// 指向下一个hook
	next: Hook | null
}

export function renderWithHooks(wip: FiberNode) {
	// 赋值
	currentlyRenderingFiber = wip
	wip.memoizedState = null

	const current = wip.alternate
	if (current !== null) {
		// update
	} else {
		// mount
	}

	const Component = wip.type
	const props = wip.pendingProps
	const children = Component(props)

	// 重置
	currentlyRenderingFiber = null
	return children
}
