import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	UpdateQueue
} from './updateQueue'
import {Dispatcher, Dispatch} from 'react/src/currentDispatcher'
import internals from 'shared/internals'
import {FiberNode} from './fiber'
import {Action} from 'shared/ReactTypes'
import {scheduleUpdateOnFiber} from './workLoop'

// 当前正在render的fiber
let currentlyRenderingFiber: FiberNode | null = null

// 用来指向正在处理的hook
let workInProgressHook: Hook | null = null

const {currentDispatcher} = internals

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
		// update 阶段
	} else {
		// mount 阶段
		//	共享数据层的hooks指向 Reconciler mount阶段的hooks
		currentDispatcher.current = HooksDispatcherOnMount
	}

	const Component = wip.type
	const props = wip.pendingProps
	const children = Component(props)

	// 重置
	currentlyRenderingFiber = null
	return children
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
}

function mountState<State>(
	initialState: (() => State) | State
): [State, Dispatch<State>] {
	// 需要先找到当前useState对应的hook
	const hook = mountWorkInProgresHook()

	let memoizedState
	if (initialState instanceof Function) {
		memoizedState = initialState()
	} else {
		memoizedState = initialState
	}

	/**
	 * 因为useState是可以触发更新的
	 * 所以我们需要为这个hook创建updateQueue
	 */
	const queue = createUpdateQueue<State>()
	// 把这个updateQueue存放在hook的updateQueue中
	hook.updateQueue = queue
	// 把计算出来的memoizedState保存在当前hook中 update时才有上一次的值
	hook.memoizedState = memoizedState

	// 这里dispatchSetState通过函数柯里化或者叫偏函数的方式把当前Fiber和updateQueue两个参数预置进dispacth
	// 这样dispatch就可以脱离当前组件去使用 用户只需要传 Action<State> 就行了 比如：updateNum(x) | updateNum(x=>2x)
	// @ts-ignore
	const dispacth = dispatchSetState.bind(null, currentlyRenderingFiber, queue)
	//	再把dispatch存在updateQueue中
	queue.dispatch = dispacth
	return [memoizedState, dispacth]
}

/**
 * 实现dispacth
 * dispatch方法需要接入更新流程
 * 1、创建update 【createUpdate】
 * 2、把update加入updateQueue【enqueueUpdate】
 * 3、调度Fiber 【scheduleUpdateOnFiber】
 * */
function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	// 创建update
	const update = createUpdate<State>(action)
	enqueueUpdate(updateQueue, update)
	scheduleUpdateOnFiber(fiber)
}

// mount阶段获取当前hook
function mountWorkInProgresHook() {
	const hook: Hook = {
		memoizedState: null,
		updateQueue: null,
		next: null
	}

	if (workInProgressHook === null) {
		// mount时 第一个hook
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook')
		} else {
			workInProgressHook = hook
			// FunctionComponent的memoizedState保存hooks的链表
			currentlyRenderingFiber.memoizedState = workInProgressHook
		}
	} else {
		// mount时 后续的hook
		workInProgressHook.next = hook
		// 然后更新workInProgressHook的指向
		workInProgressHook = hook
	}

	return workInProgressHook
}
