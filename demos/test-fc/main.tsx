import React, {useState} from 'react'
import ReactDOM from 'react-dom/client'

const App = () => {
	const [num, updateNum] = useState(100)
	// @ts-ignore
	window.updateNum = updateNum
	return num === 3 ? <p>333</p> : <div>555</div>
}

const Child = () => {
	return (
		<div>
			<span>ps-react</span>
		</div>
	)
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
)
