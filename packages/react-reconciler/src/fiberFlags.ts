export type Flags = number

export const NoFlags = 0b0000000
export const Placement = 0b0000001
export const Update = 0b0000010
export const ChildDeletion = 0b0000100

//  代表Fiber本次更新需要触发 useEffect的情况 需要执行create
export const PassiveEffect = 0b0001000

export const MutationMask = Placement | Update | ChildDeletion

//  PassiveEffect需要执行 useEffect ，ChildDeletion需要执行 destroy
export const PassiveMask = PassiveEffect | ChildDeletion
