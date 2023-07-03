import {MutationMask, NoFlags} from './fiberFlags'
/**
 * 完整的工作循环的文件
 */
import {HostRoot} from './workTags'
import {createWorkInProgress, FiberRootNode} from './fiber'
import {beginWork} from './beginWork'
import {completeWork} from './completeWork'

import {FiberNode} from './fiber'
import {commitMutationEffects} from './commitMutation'

// 先定义一个全局的指针，指向正在工作的fiberNode
let workInProgress: FiberNode | null = null

// 把workInProgress指向第一个需要遍历的fiberNode
function prepareFreshStack(root: FiberRootNode) {
	workInProgress = createWorkInProgress(root.current, {})
}

// 调度功能
export function scheduleUpdateOnFiber(fiber: FiberNode) {
	const root = markUpdateFromFiberToRoot(fiber)
	//	从FiberRootNode开始调度
	renderRoot(root)
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

// 调度方法
function renderRoot(root: FiberRootNode) {
	// 1、初始化
	prepareFreshStack(root)

	// 2、执行递归的流程
	do {
		try {
			workLoop()
			break
		} catch (error) {
			if (__DEV__) {
				console.warn('workLoop发生错误', error)
			}
			workInProgress = null
		}
	} while (true)

	// 执行workLoop后会得到一颗操作后的workInProgress Fiber树
	const finishedWork = root.current.alternate
	root.finishedWork = finishedWork

	//	根据wip Fiber树和树中的flags 执行具体的DOM操作
	commitRoot(root)
}

function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork

	//	如果finishedWork没有，则不会执行commit阶段
	if (finishedWork === null) {
		return
	}

	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork)
	}

	// 重置root中finishedWork
	root.finishedWork = null

	// 判断是否存在3个子阶段需要执行的操作
	// 判断root的subtreeFlags 和 root的flags 是否包含需要操作的flags
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags
	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation

		// mutation
		commitMutationEffects(finishedWork)

		root.current = finishedWork

		// layout
	} else {
		// 切换FiberRootNode的current指针
		// current指向最新的workInProgress Fiber树
		root.current = finishedWork
	}
}

//	调度的循环
function workLoop() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress)
	}
}

//	执行工作单元
function performUnitOfWork(fiber: FiberNode) {
	//	next 是这个fiber的子fiber 或者没有就为null
	const next = beginWork(fiber)
	fiber.memoizedProps = fiber.pendingProps

	if (next === null) {
		// 2、没有子节点就遍历兄弟节点
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
		//	如果sibling存在，就把sibling赋值给workInProgress，继续执行workLoop
		if (sibling !== null) {
			workInProgress = sibling
			return
		}
		//	如果不存在兄弟节点，则把node.return赋值给node，继续执行do while循环，完成父节点的completeWork
		node = node.return
	} while (node !== null)
}
