import * as React from 'react'

// 在shared中 中转内部数据共享层
const internals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED

// 最终在react-reconciler中引入internals 就实现了中转
export default internals
