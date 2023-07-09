import {Lane, NoLane} from './fiberLanes'
/**
 * 【重要】
 * 处理hook
 */
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue,
	UpdateQueue
} from './updateQueue'
import {Dispatcher, Dispatch} from 'react/src/currentDispatcher'
import internals from 'shared/internals'
import {FiberNode} from './fiber'
import {Action} from 'shared/ReactTypes'
import {scheduleUpdateOnFiber} from './workLoop'
import {requestUpdateLane} from './fiberLanes'
import {Flags, PassiveEffect} from './fiberFlags'
import {HookHasEffect, Passive} from './hookEffectTags'

// 当前正在render的fiber
let currentlyRenderingFiber: FiberNode | null = null

// 用来指向正在处理的hook
let workInProgressHook: Hook | null = null

//	用来指向当前hook
let currentHook: Hook | null = null

let renderLane = NoLane

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

export interface Effect {
	tag: Flags
	create: EffectCallback | void
	destroy: EffectCallback | void
	deps: EffectDeps
	next: Effect | null //指向下一个Fiber的hook.memoizedState中
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null // 指向useEffect环状链表的最后一个
}

type EffectCallback = () => void
type EffectDeps = any[] | null

export function renderWithHooks(wip: FiberNode, lane: Lane) {
	// 赋值
	currentlyRenderingFiber = wip
	wip.memoizedState = null
	renderLane = lane

	const current = wip.alternate
	if (current !== null) {
		// update 阶段
		//	共享数据层的hooks指向 render update阶段的hooks
		currentDispatcher.current = HooksDispatcherOnUpdate
	} else {
		// mount 阶段
		//	共享数据层的hooks指向 render mount阶段的hooks
		currentDispatcher.current = HooksDispatcherOnMount
	}

	const Component = wip.type
	const props = wip.pendingProps
	// 执行这个FunctionComponent 即这个函数组件的render
	const children = Component(props)

	// 重置
	currentlyRenderingFiber = null
	workInProgressHook = null
	currentHook = null
	renderLane = NoLane
	return children
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect
}

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect
}

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	const hook = mountWorkInProgresHook()
	const nextDeps = deps === undefined ? null : deps
	//	mount 时需要执行create 当前Fiber需要标记 PassiveEffect
	;(currentlyRenderingFiber as FiberNode).tag |= PassiveEffect

	//	把次hook保存在hook.memoizedState中
	hook.memoizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		undefined,
		nextDeps
	)
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	//
}

function pushEffect(
	hookFlags: Flags,
	create: EffectCallback | void,
	destroy: EffectCallback | void,
	deps: EffectDeps
) {
	// 先定义一个Effect
	const effect: Effect = {
		tag: hookFlags,
		create,
		destroy,
		deps,
		next: null
	}
	const fiber = currentlyRenderingFiber as FiberNode
	//	把useEffect的环状链表保存在Fiber的updateQueue上
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>
	if (updateQueue === null) {
		const updateQueue = createFCUpdateQueue()
		fiber.updateQueue = updateQueue
		//	effect和自己形成环状链表
		effect.next = effect
		updateQueue.lastEffect = effect
	} else {
		//	插入 Effect
		const lastEffect = updateQueue.lastEffect
		if (lastEffect === null) {
			effect.next = effect
			updateQueue.lastEffect = effect
		} else {
			//	把新创建的 effect 插入在末尾 并和第一个effct连接形成新的环状链表
			const firstEffect = lastEffect.next
			lastEffect.next = effect
			effect.next = firstEffect
			updateQueue.lastEffect = effect
		}
	}
	return effect
}

function createFCUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>
	updateQueue.lastEffect = null
	return updateQueue
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
 * 比如进入<App/>对应的FunctionComponent Fiber
 * function App() {
 * 		const [num, updateNum] = useState(0)
 * 		const [str, updateStr] = useState('a')
 * 		const [bol, updateBol] = useState(false)
 *  ...
 * }
 * <App/>中有三个hook
 * App 组件update时，会执行三个 useState(xxx)
 * 每次执行 updateState 方法都要找到当前的 useState
 * 其中 updateWorkInProgresHook 就是去寻找当前的 useState
 */
function updateState<State>(): [State, Dispatch<State>] {
	// 需要先找到当前useState对应的hook
	const hook = updateWorkInProgresHook()

	// 计算hook
	const queue = hook.updateQueue as UpdateQueue<State>
	const update = queue.shared.pending
	const baseState = hook.memoizedState
	// update从queue.shared.pending中拿出来消费掉后要 重置
	queue.shared.pending = null

	if (update !== null) {
		const {memoizedState} = processUpdateQueue(baseState, update, renderLane)
		// 消费update后 计算出最新的状态 重新赋值给hook.memoizedState
		hook.memoizedState = memoizedState
	}

	return [hook.memoizedState, queue.dispatch as Dispatch<State>]
}

/**
 * 实现dispacth
 * dispatch方法需要接入更新流程
 * 1、创建update 【createUpdate】
 * 2、把update加入updateQueue【enqueueUpdate】
 * 3、调度Fiber 【scheduleUpdateOnFiber】
 * */
// 这个方法的触发条件 1、onClick事件的回调 2、useEffect副作用
function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	// 创建update 先获取这个更新的优先级
	const lane = requestUpdateLane()
	const update = createUpdate<State>(action, lane)
	enqueueUpdate(updateQueue, update)
	scheduleUpdateOnFiber(fiber, lane)
}

// mount阶段获取当前hook
function mountWorkInProgresHook() {
	// mount时 是新建的hook
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
			//
			/**
			 * FunctionComponent的memoizedState保存hooks的链表
			 * 把第一个hook挂载在memoizedState上
			 * 后续的hook通过next指针依次挂载 形成一条单向链表
			 */
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

// update阶段获取当前hook
function updateWorkInProgresHook() {
	// todo render阶段触发的更新
	// update时 hook 从wip->alternate 即 current的memoized来
	let nextCurrentHook: Hook | null = null

	if (currentHook === null) {
		// 表示这个FC update时的第一个hook
		const current = currentlyRenderingFiber?.alternate
		if (current !== null) {
			nextCurrentHook = current?.memoizedState
		} else {
			// mount 阶段current才会是null 说明是边界错误
			nextCurrentHook = null
		}
	} else {
		nextCurrentHook = currentHook.next
	}

	// update 时多了一个 u4
	if (nextCurrentHook === null) {
		// mount/update u1 u2 u3
		// update       u1 u2 u3 u4
		throw new Error(
			`组件${currentlyRenderingFiber?.type}本次执行时的Hook比上次执行时多`
		)
	}

	currentHook = nextCurrentHook
	const newHook: Hook = {
		memoizedState: nextCurrentHook?.memoizedState,
		updateQueue: nextCurrentHook?.updateQueue,
		next: null
	}

	if (workInProgressHook === null) {
		// mount时 第一个hook
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook')
		} else {
			workInProgressHook = newHook
			// FunctionComponent的memoizedState保存hooks的链表
			currentlyRenderingFiber.memoizedState = workInProgressHook
		}
	} else {
		// mount时 后续的hook
		workInProgressHook.next = newHook
		// 然后更新workInProgressHook的指向
		workInProgressHook = newHook
	}

	return workInProgressHook
}
