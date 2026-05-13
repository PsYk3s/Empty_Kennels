import { NavLink, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LeadPage } from './pages/LeadPage';
import { CataloguesPage } from './pages/CataloguesPage';
import { SyncPage } from './pages/SyncPage';
import { SettingsPage } from './pages/SettingsPage';
export default function App(){return <div className='layout'><nav>{['/','/lead','/catalogues','/sync','/settings'].map((p,i)=><NavLink key={p} to={p}>{['Home','Capture Lead','Catalogues','Sync Status','Settings'][i]}</NavLink>)}</nav><main><Routes><Route path='/' element={<HomePage/>}/><Route path='/lead' element={<LeadPage/>}/><Route path='/catalogues' element={<CataloguesPage/>}/><Route path='/sync' element={<SyncPage/>}/><Route path='/settings' element={<SettingsPage/>}/></Routes></main></div>}
