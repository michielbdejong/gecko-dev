/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * The contents of this file are subject to the Netscape Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/NPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is Netscape
 * Communications Corporation.  Portions created by Netscape are
 * Copyright (C) 1998 Netscape Communications Corporation. All
 * Rights Reserved.
 *
 * Contributor(s): 
 *   Pierre Phaneuf <pp@ludusdesign.com>
 */

#include <windows.h>
#include <iostream.h>
#include "nsISupports.h"
#include "nsIFactory.h"

// {5846BA30-B856-11d1-A98A-00805F8A7AC4}
#define NS_ITEST_COM_IID \
{ 0x5846ba30, 0xb856, 0x11d1, \
  { 0xa9, 0x8a, 0x0, 0x80, 0x5f, 0x8a, 0x7a, 0xc4 } }

class nsITestCom: public nsISupports
{
public:
  NS_DEFINE_STATIC_IID_ACCESSOR(NS_ITEST_COM_IID)
  NS_IMETHOD Test() = 0;
};

/*
 * nsTestCom
 */

class nsTestCom: public nsITestCom {
  NS_DECL_ISUPPORTS

public:
  nsTestCom() {
    NS_INIT_REFCNT();
  }
  virtual ~nsTestCom() {
    cout << "nsTestCom instance successfully deleted\n";
  }

  NS_IMETHOD Test() {
    cout << "Accessed nsITestCom::Test() from COM\n";
    return NS_OK;
  }
};

NS_IMPL_QUERY_INTERFACE(nsTestCom, NS_GET_IID(nsITestCom));

nsrefcnt nsTestCom::AddRef() 
{
  nsrefcnt res = ++mRefCnt;
  NS_LOG_ADDREF(this, mRefCnt, "nsTestCom", sizeof(*this));
  cout << "nsTestCom: Adding ref = " << res << "\n";
  return res;
}

nsrefcnt nsTestCom::Release() 
{
  nsrefcnt res = --mRefCnt;
  NS_LOG_RELEASE(this, mRefCnt, "nsTestCom");
  cout << "nsTestCom: Releasing = " << res << "\n";
  if (res == 0) {
    delete this;
  }
  return res;
}

class nsTestComFactory: public nsIFactory {
  NS_DECL_ISUPPORTS
public:
  nsTestComFactory() {
    NS_INIT_REFCNT();
  }
  
  NS_IMETHOD CreateInstance(nsISupports *aOuter,
                            const nsIID &aIID,
                            void **aResult);

  NS_IMETHOD LockFactory(PRBool aLock) {
    cout << "nsTestComFactory: ";
    cout << (aLock == PR_TRUE ? "Locking server" : "Unlocking server");
    cout << "\n";
    return S_OK;
  }
};

NS_IMPL_ISUPPORTS(nsTestComFactory, NS_GET_IID(nsIFactory));

nsresult nsTestComFactory::CreateInstance(nsISupports *aOuter,
					  const nsIID &aIID,
					  void **aResult)
{
  if (aOuter != NULL) {
    return NS_ERROR_NO_AGGREGATION;
  }

  nsTestCom *t = new nsTestCom();
  
  if (t == NULL) {
    return NS_ERROR_OUT_OF_MEMORY;
  }
  
  nsresult res = t->QueryInterface(aIID, aResult);

  if (NS_FAILED(res)) {
    *aResult = NULL;
    delete t;
  }

  cout << "nsTestComFactory: successfully created nsTestCom instance\n";

  return res;
}

/*
 * main
 */

int main(int argc, char *argv[])
{
  nsTestComFactory *inst = new nsTestComFactory();
  IClassFactory *iFactory;
  inst->QueryInterface(NS_GET_IID(nsIFactory), (void **) &iFactory);

  IUnknown *iUnknown;  
  nsITestCom *iTestCom;

  nsresult res;
  iFactory->LockServer(TRUE);
  res = iFactory->CreateInstance(NULL,
				 IID_IUnknown, 
				 (void **) &iUnknown);
  iFactory->LockServer(FALSE);

  GUID testGUID = NS_ITEST_COM_IID;
  HRESULT hres;
  hres= iUnknown->QueryInterface(testGUID, 
				 (void **) &iTestCom);

  iTestCom->Test();

  iUnknown->Release();
  iTestCom->Release();
  iFactory->Release();

  return 0;
}

