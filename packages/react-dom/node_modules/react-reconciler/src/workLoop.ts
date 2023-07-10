import {
	lanesToSchedulerPriority,
	markRootFinished,
	NoLane,
	SyncLane
} from './fiberLanes'
/**
 * 完整的工作循环的文件
 */
import {MutationMask, NoFlags, PassiveMask} from './fiberFlags'
import {HostRoot} from './workTags'
import {
	createWorkInProgress,
	FiberRootNode,
	pendingPassiveEffects
} from './fiber'
import {beginWork} from './beginWork'
import {completeWork} from './completeWork'

import {FiberNode} from './fiber'
import {
	commitHookEffectListCreate,
	commitHookEffectListDestroy,
	commitHookEffectListUnmount,
	commitMutationEffects
} from './commitWork'
import {getHighestPriorityLane, Lane, mergeLanes} from './fiberLanes'
import {flushSyncCallbacks, scheduleSyncCallback} from './syncTaskQueue'
import {scheduleMicroTask} from 'hostConfig'
import {
	unstable_cancelCallback,
	unstable_NormalPriority as NormalPriority,
	unstable_scheduleCallback as scheduleCallback,
	unstable_shouldYield
} from 'scheduler'
import {HookHasEffect, Passive} from './hookEffectTags'

// 先定义一个全局的指针，指向正在工作的fiberNode
let workInProgress: FiberNode | null = null
// 定义一个当前正在更新的Lane是什么
let wipRootRenderLane = NoLane
//	用来防止多次执行commitRoot函数
let rootDoesHasPassiveEffects = false

//	当前root render阶段退出的状态
type RootExitStatus = number
// 	中断 还未执行完
const RootInComplete = 1
//	执行完成
const RootCompleted = 2
//	todo 执行报错 也是中断

/**
 * 1、创建workInProgress
 * 2、并把workInProgress指向第一个需要遍历的fiberNode
 */
function prepareFreshStack(root: FiberRootNode, renderLane: Lane) {
	root.finishedLane = NoLane
	root.finishedWork = null
	workInProgress = createWorkInProgress(root.current, {})
	wipRootRenderLane = renderLane
}

/**
 * 调度功能
 * 每次更新都会触发 次方法
 */
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	// 调度开始先找到FiberRootNode 每次更新都从整个应用的根节点开始
	const root = markUpdateFromFiberToRoot(fiber)
	//	把本次更新的lane记录在FiberRootNode的pendingLanes中
	markRootUpdated(root, lane)
	//	从FiberRootNode开始执行render阶段
	ensureRootIsScheduled(root)
}

//	调度阶段的入口 保证root被调用了
function ensureRootIsScheduled(root: FiberRootNode) {
	//	获取root中优先级最高的Lane
	const updateLane = getHighestPriorityLane(root.pendingLanes)
	const exitingCallback = root.callbackNode

	// 没有Lane 说明没有更新
	if (updateLane === NoLane) {
		if (exitingCallback !== null) {
			unstable_cancelCallback(exitingCallback)
		}
		root.callbackNode = null
		root.callbackPriority = NoLane
		return
	}

	//	相同优先级 不产生新的调度
	const curPriority = updateLane
	const prevPriority = root.callbackPriority
	if (curPriority === prevPriority) {
		return
	}

	//	如果更高优先级 需要把之前的回调取消掉
	if (exitingCallback !== null) {
		unstable_cancelCallback(exitingCallback)
	}

	let newCallbackNode = null

	if (updateLane === SyncLane) {
		//	同步优先级 用微任务调度 调度什么呢 肯定是调度render阶段的执行
		if (__DEV__) {
			console.warn('在微任务中调度，优先级', updateLane)
		}
		/**
		 * scheduleSyncCallback会把rendeer阶段的开始函数存在syncQueue里 每触发一次更新就会往里push一个
		 * 像这样 [performSyncWorkOnRoot, performSyncWorkOnRoot, performSyncWorkOnRoot]
		 */
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane))
		// 然后在微任务中执行每一个syncQueue中的callback
		scheduleMicroTask(flushSyncCallbacks)
	} else {
		//	其他优先级 用宏任务调度
		const schedulerPriority = lanesToSchedulerPriority(updateLane)
		newCallbackNode = scheduleCallback(
			schedulerPriority,
			performConcurrentWorkOnRoot.bind(null, root)
		)
	}

	root.callbackNode = newCallbackNode
	root.callbackPriority = curPriority
}

function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane)
}

/**
 * 找到根节点
 * 更新有几种方式
 * 1、ReactDom.createRoot(rootElement).render(<App/>)
 * 2、class Component this.setState
 * 3、Function Component setState
 * 第1种是从FiberRootNode开始
 * 第2、3会从某一个节点开始
 * 所以需要先从根据开始节点往上，找到根FiberRootNode
 */
function markUpdateFromFiberToRoot(fiber: FiberNode) {
	let node = fiber
	let parent = node.return
	while (parent !== null) {
		node = parent
		parent = node.return
	}
	if (node.tag === HostRoot) {
		return node.stateNode
	}
	return null
}

/**
 * 并发调度
 */
function performConcurrentWorkOnRoot(
	root: FiberRootNode,
	didTimeout: boolean
): any {
	/**
	 * 执行并发调度之前 需要保证useEffect的回调执行完了
	 * 因为在useEffect中可能产生新的更新 setState
	 * 并且可能比当前的调度优先级更高
	 */
	const curCallback = root.callbackNode
	const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects)
	if (didFlushPassiveEffect) {
		//	代表flushPassiveEffects执行产生了新的更新 且优先级比当前执行的更高
		if (root.callbackNode !== curCallback) {
			return null
		}
	}

	//	先获取最高优先级
	const lane = getHighestPriorityLane(root.pendingLanes)
	const curCallbackNode = root.callbackNode
	if (lane === NoLane) {
		return
	}

	//	lane是Synclane 或者过期了 则是同步优先级
	const needSync = lane === SyncLane || didTimeout

	//	render阶段
	const exitStatus = renderRoot(root, lane, !needSync)

	ensureRootIsScheduled(root)

	//	退出状态是中断 未结束状态
	if (exitStatus === RootInComplete) {
		if (root.callbackNode !== curCallbackNode) {
			//	不相等说明有个更高优先级的任务插入
			return null
		}
		//	否则继续调度当前的回调函数
		return performConcurrentWorkOnRoot.bind(null, root)
	}

	//	render阶段完成
	if (exitStatus === RootCompleted) {
		/**
		 * 完成以后会得到一颗操作后的workInProgress Fiber树
		 * 并把这颗Fiber树挂载FiberRootNode的finishedWork上
		 * 并把本次更新的Lane赋值到FiberRootNode上
		 */
		const finishedWork = root.current.alternate
		root.finishedWork = finishedWork
		root.finishedLane = lane
		// render结束重置 wipRootRenderLane
		wipRootRenderLane = NoLane

		/**
		 * 根据wip Fiber树和树中的flags 执行具体的DOM操作
		 * commit阶段开始
		 */
		commitRoot(root)
	} else if (__DEV__) {
		console.error('还未实现的并发更新结束状态')
	}
}

/**
 * 同步调度
 */
function performSyncWorkOnRoot(root: FiberRootNode) {
	// 因为多次更新 添加到syncQueue中多次 冲洗时遍历syncQueue会多次执行
	//	所以先获取下最高优先级 先做个判断
	const nextLane = getHighestPriorityLane(root.pendingLanes)
	if (nextLane !== SyncLane) {
		//1、比SyncLane更低的优先级
		//2、nextLane可能是NoLane
		// 不管哪种情况 再调度一次 即便再调度 如果是NoLane 也会直接被return掉
		ensureRootIsScheduled(root)
		return
	}

	const exitStatus = renderRoot(root, nextLane, false)

	//	3、render阶段完成
	if (exitStatus === RootCompleted) {
		/**
		 * 完成以后会得到一颗操作后的workInProgress Fiber树
		 * 并把这颗Fiber树挂载FiberRootNode的finishedWork上
		 * 并把本次更新的Lane赋值到FiberRootNode上
		 */
		const finishedWork = root.current.alternate
		root.finishedWork = finishedWork
		root.finishedLane = nextLane
		// render结束重置 wipRootRenderLane
		wipRootRenderLane = NoLane

		/**
		 * 根据wip Fiber树和树中的flags 执行具体的DOM操作
		 * commit阶段开始
		 */
		commitRoot(root)
	} else if (__DEV__) {
		console.error('还未实现的同步更新结束状态')
	}
}

/**
 * shouldTimeSlice 是否开启【时间切片】
 */
function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
	if (__DEV__) {
		console.warn('render阶段开始')
		console.log(`开始${shouldTimeSlice ? '并发' : '同步'}更新`, root)
	}

	/**
	 * 并发更新有可能中断
	 * 不用每次进来都初始化
	 * 当前lane：wipRootRenderLane !== 传进来的lane 才执行初始化
	 */
	if (wipRootRenderLane !== lane) {
		// 1、初始化
		prepareFreshStack(root, lane)
	}

	// 2、执行递归的流程
	do {
		try {
			shouldTimeSlice ? workLoopConcurrent() : workLoopSync()
			break
		} catch (error) {
			if (__DEV__) {
				console.warn('workLoop发生错误', error)
			}
			workInProgress = null
		}
	} while (true)

	//	中断执行 || render阶段执行完
	if (shouldTimeSlice && workInProgress !== null) {
		//	中断 未执行完
		return RootInComplete
	}

	// render阶段执行完
	if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
		console.error(`render阶段结束时wip不应该不是null`)
	}

	//	todo render阶段报错
	return RootCompleted
}

// 开启commit阶段
function commitRoot(root: FiberRootNode) {
	//	这里的finishedWork就是执行操作后的workInProgress Fiber树
	const finishedWork = root.finishedWork

	//	如果finishedWork没有，则不会执行commit阶段
	if (finishedWork === null) {
		return
	}

	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork)
	}

	const lane = root.finishedLane
	if (lane === NoLane && __DEV__) {
		console.warn('commit阶段finishedLane不应该是NoLane')
	}

	// 重置root中finishedWork
	root.finishedWork = null
	root.finishedLane = NoLane
	// 重置Lane 移除本次消费的lane
	markRootFinished(root, lane)

	//	这两种情况 代表这颗Fiber树中是存在函数组件 需要执行useEffect的create的
	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		if (!rootDoesHasPassiveEffects) {
			rootDoesHasPassiveEffects = true
			/**
			 * 1、开始调度副作用
			 * 2、收集回调函数 (create, destroy) 在commitWork中收集
			 */
			scheduleCallback(NormalPriority, () => {
				// 3、commit结束后执行副作用的回调函数
				flushPassiveEffects(root.pendingPassiveEffects)
				return
			})
		}
	}

	// 判断是否存在3个子阶段需要执行的操作
	// 判断root的subtreeFlags 和 root的flags 是否包含需要操作的flags
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags
	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation

		// mutation
		commitMutationEffects(finishedWork, root)

		root.current = finishedWork

		// layout
	} else {
		// 切换FiberRootNode的current指针
		// current指向最新的workInProgress Fiber树
		root.current = finishedWork
	}

	// 重置标记
	rootDoesHasPassiveEffects = false
	//	再重新调度下root
	ensureRootIsScheduled(root)
}

// 冲洗(执行)收集的副作用的回调函数
function flushPassiveEffects(pendingPassiveEffects: pendingPassiveEffects) {
	let didFlushPassiveEffect = false
	/**
	 * 执行的顺序：
	 * 1、先从叶子节点开始执行destroy，依次往上 destroy保存在unmount中
	 * 2、再从叶子节点开始执行create，依次往上 create保存在update中
	 * */
	pendingPassiveEffects.unmount.forEach((effect) => {
		// 执行卸载组件的destroy
		didFlushPassiveEffect = true
		commitHookEffectListUnmount(Passive, effect)
	})
	pendingPassiveEffects.unmount = []

	// 本次更新先执行上一次生成的所有destroy
	pendingPassiveEffects.update.forEach((effect) => {
		// 执行update的destroy
		didFlushPassiveEffect = true
		commitHookEffectListDestroy(Passive | HookHasEffect, effect)
	})
	pendingPassiveEffects.update.forEach((effect) => {
		// 执行update的create
		didFlushPassiveEffect = true
		commitHookEffectListCreate(Passive | HookHasEffect, effect)
	})
	pendingPassiveEffects.update = []

	//	本次更新的副作用中可能有新的更新
	flushSyncCallbacks()
	return didFlushPassiveEffect
}

/**
 * 调度的循环
 * DFS 深度优先遍历的方式 递归
 */
function workLoopSync() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress)
	}
}
function workLoopConcurrent() {
	/**
	 * unstable_shouldYield() 返回是否应该被中断 true：应该中断，false：不应该中断
	 */
	while (workInProgress !== null && !unstable_shouldYield()) {
		performUnitOfWork(workInProgress)
	}
}

//	执行工作单元
function performUnitOfWork(fiber: FiberNode) {
	//	next 是这个fiber的子fiber 或者没有就为null
	const next = beginWork(fiber, wipRootRenderLane)
	fiber.memoizedProps = fiber.pendingProps

	if (next === null) {
		// 2、没有子节点就遍历兄弟节点 兄弟节点遍历完就继续往上执行completeWork
		completeUnitOfWork(fiber)
	} else {
		/**
		 *  1、有子节点，就遍历子节点
		 *  就把next赋值给workInProgress，继续执行workLoop，继续向下遍历
		 *  */
		workInProgress = next
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber
	do {
		completeWork(node)
		//	执行完completeWork，只需要看sibling存不存在
		const sibling = node.sibling
		//	1、如果sibling存在，就把sibling赋值给workInProgress，继续执行workLoop
		if (sibling !== null) {
			workInProgress = sibling
			return
		}
		//	2、如果不存在兄弟节点，则把node.return赋值给node，继续执行do while循环，完成父节点的completeWork
		node = node.return
		workInProgress = node
	} while (node !== null)
}
